import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { pois } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ classified: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a concise list for the AI
    const poisSummary = pois.slice(0, 30).map((p: any, i: number) => 
      `${i + 1}. "${p.nome}" (${p.tipo_label || p.amenity || "desconhecido"})${p.endereco ? ` - ${p.endereco}` : ""}`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um classificador de estabelecimentos para uma empresa de gelo saborizado (gelo gourmet para drinks/bebidas).
Classifique cada estabelecimento como potencial cliente.

Critérios de ALTA compatibilidade:
- Bares, pubs, lounges, casas noturnas, tabacarias com drinks
- Distribuidoras de bebidas
- Choperia, drinkeria, espetaria com bar
- Eventos, buffets, restaurantes com bar

Critérios de MÉDIA compatibilidade:
- Restaurantes sem foco em drinks
- Hamburguerias, lanchonetes com venda de bebidas
- Mercados, conveniências
- Cafés com venda de drinks

Critérios de BAIXA compatibilidade / Não compatível:
- Padarias, farmácias, lojas de roupa
- Estabelecimentos que claramente não vendem bebidas

Responda APENAS com o JSON usando tool calling.`
          },
          {
            role: "user",
            content: `Classifique estes estabelecimentos encontrados na região:\n\n${poisSummary}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_establishments",
              description: "Classify each establishment for ice sales potential",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "1-based index of the establishment" },
                        tag: { type: "string", enum: ["cliente_potencial", "avaliar", "nao_compativel"] },
                        prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
                        motivo: { type: "string", description: "Brief reason in Portuguese, max 15 words" }
                      },
                      required: ["index", "tag", "prioridade", "motivo"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["results"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_establishments" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI classification failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    
    // Extract tool call result
    let classified: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        classified = parsed.results || [];
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }

    // Merge classifications back into POIs
    const result = pois.slice(0, 30).map((poi: any, i: number) => {
      const cls = classified.find((c: any) => c.index === i + 1);
      return {
        ...poi,
        ai_tag: cls?.tag || "avaliar",
        ai_prioridade: cls?.prioridade || "media",
        ai_motivo: cls?.motivo || "Análise pendente",
      };
    });

    return new Response(JSON.stringify({ classified: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-pois error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
