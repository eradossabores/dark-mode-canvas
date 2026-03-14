import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { dia_semana, sabores_analise } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical decisions (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: decisoes } = await supabase
      .from("decisoes_producao")
      .select("*")
      .gte("created_at", ninetyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    // Fetch recent sales (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: vendaItens } = await supabase
      .from("venda_itens")
      .select("sabor_id, quantidade, venda_id, vendas!inner(created_at, status)")
      .gte("vendas.created_at", thirtyDaysAgo.toISOString())
      .neq("vendas.status", "cancelada");

    // Fetch recent production
    const { data: producoes } = await supabase
      .from("producoes")
      .select("sabor_id, quantidade_total, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Build context for AI
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    
    // Aggregate sales by day of week
    const vendasPorDia: Record<number, number> = {};
    (vendaItens || []).forEach((v: any) => {
      const dia = new Date(v.vendas?.created_at).getDay();
      vendasPorDia[dia] = (vendasPorDia[dia] || 0) + v.quantidade;
    });

    // Build historical decision summary per flavor
    const decisoesPorSabor: Record<string, any[]> = {};
    (decisoes || []).forEach((d: any) => {
      if (!decisoesPorSabor[d.sabor_nome]) decisoesPorSabor[d.sabor_nome] = [];
      decisoesPorSabor[d.sabor_nome].push({
        dia: diasSemana[d.dia_semana],
        lotes_sugeridos: d.lotes_sugeridos,
        lotes_autorizados: d.lotes_autorizados,
        ajuste: d.lotes_autorizados - d.lotes_sugeridos,
        estoque: d.estoque_no_momento,
        vendas_7d: d.vendas_7d,
        data: d.created_at.slice(0, 10),
      });
    });

    // Feedback: compare planned vs actual production
    const feedbackPorSabor: Record<string, { planejado: number; produzido: number; vendido: number }> = {};
    (sabores_analise || []).forEach((s: any) => {
      const planejado = (decisoesPorSabor[s.nome] || [])
        .reduce((sum: number, d: any) => sum + d.lotes_autorizados * 84, 0);
      const produzido = (producoes || [])
        .filter((p: any) => p.sabor_id === s.id)
        .reduce((sum: number, p: any) => sum + p.quantidade_total, 0);
      const vendido = (vendaItens || [])
        .filter((v: any) => v.sabor_id === s.id)
        .reduce((sum: number, v: any) => sum + v.quantidade, 0);
      feedbackPorSabor[s.nome] = { planejado, produzido, vendido };
    });

    const saboresContext = (sabores_analise || []).map((s: any) => {
      const hist = decisoesPorSabor[s.nome] || [];
      const fb = feedbackPorSabor[s.nome] || { planejado: 0, produzido: 0, vendido: 0 };
      const ultimas5 = hist.slice(0, 5);
      return `- ${s.nome}: estoque=${s.estoqueAtual}, média=${s.mediaDiaria}/dia, cobertura=${s.diasCobertura}d, vendas7d=${s.vendas7d}, tendência=${s.tendencia}
  Histórico decisões (últimas 5): ${ultimas5.length > 0 ? ultimas5.map((h: any) => `${h.dia} ${h.data}: sugerido=${h.lotes_sugeridos}, autorizado=${h.lotes_autorizados} (ajuste ${h.ajuste > 0 ? '+' : ''}${h.ajuste})`).join('; ') : 'sem histórico'}
  Feedback 30d: planejado=${fb.planejado}un, produzido=${fb.produzido}un, vendido=${fb.vendido}un ${fb.produzido > fb.vendido * 1.5 ? '⚠️ EXCESSO' : fb.vendido > fb.produzido * 0.9 ? '⚠️ DÉFICIT' : '✅ EQUILIBRADO'}`;
    }).join("\n");

    const prompt = `Você é o assistente de produção de uma fábrica de gelo saborizado em Boa Vista-RR.
Hoje é ${diasSemana[dia_semana]}.

VENDAS POR DIA DA SEMANA (últimos 30 dias):
${Object.entries(vendasPorDia).map(([d, q]) => `${diasSemana[Number(d)]}: ${q} unidades`).join("\n")}

Total de decisões históricas: ${(decisoes || []).length} registros em ${new Set((decisoes || []).map((d: any) => d.created_at.slice(0, 10))).size} dias

SABORES (análise atual):
${saboresContext}

REGRAS:
- 1 lote = 84 unidades
- Sabores prioritários: Melancia, Maçã Verde, Morango, Maracujá, Água de Coco
- Considere o padrão de ajustes do operador (quando ele aumenta ou diminui vs sugerido)
- Considere o feedback: se está produzindo muito mais do que vende, reduza. Se está vendendo mais do que produz, aumente.
- Considere sazonalidade por dia da semana
- Seja conservador com sabores de baixa demanda

Sugira a quantidade de lotes para cada sabor, com justificativa curta e nível de confiança.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um especialista em planejamento de produção. Responda APENAS via tool calling." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_producao",
              description: "Suggest production lots for each flavor",
              parameters: {
                type: "object",
                properties: {
                  sugestoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        sabor_nome: { type: "string" },
                        lotes: { type: "number", description: "Suggested lots (0 if not needed)" },
                        confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                        justificativa: { type: "string", description: "Short reason in Portuguese, max 20 words" },
                        feedback_nota: { type: "string", description: "Feedback about production balance in Portuguese, max 15 words" },
                      },
                      required: ["sabor_nome", "lotes", "confianca", "justificativa"],
                      additionalProperties: false,
                    },
                  },
                  resumo: { type: "string", description: "Overall production insight in Portuguese, max 30 words" },
                },
                required: ["sugestoes", "resumo"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_producao" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    let result: any = { sugestoes: [], resumo: "" };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-producao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
