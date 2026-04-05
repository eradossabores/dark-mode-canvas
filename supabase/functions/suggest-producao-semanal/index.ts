import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sabores_analise, factory_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical decisions (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    let qDecisoes = supabase
      .from("decisoes_producao")
      .select("*")
      .gte("created_at", ninetyDaysAgo.toISOString())
      .order("created_at", { ascending: false });
    if (factory_id) qDecisoes = qDecisoes.eq("factory_id", factory_id);
    const { data: decisoes } = await qDecisoes;

    // Fetch recent sales (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: vendaItens } = await supabase
      .from("venda_itens")
      .select("sabor_id, quantidade, venda_id, vendas!inner(created_at, status)")
      .gte("vendas.created_at", thirtyDaysAgo.toISOString())
      .neq("vendas.status", "cancelada");

    // Fetch recent production
    let qProd = supabase
      .from("producoes")
      .select("sabor_id, quantidade_total, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString());
    if (factory_id) qProd = qProd.eq("factory_id", factory_id);
    const { data: producoes } = await qProd;

    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    
    // Sales by day of week
    const vendasPorDia: Record<number, number> = {};
    const vendasPorDiaSabor: Record<string, Record<number, number>> = {};
    (vendaItens || []).forEach((v: any) => {
      const dia = new Date(v.vendas?.created_at).getDay();
      vendasPorDia[dia] = (vendasPorDia[dia] || 0) + v.quantidade;
      if (!vendasPorDiaSabor[v.sabor_id]) vendasPorDiaSabor[v.sabor_id] = {};
      vendasPorDiaSabor[v.sabor_id][dia] = (vendasPorDiaSabor[v.sabor_id][dia] || 0) + v.quantidade;
    });

    // Historical decisions by sabor
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

    // Feedback per sabor
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
      const vendasDiaSabor = vendasPorDiaSabor[s.id] || {};
      const diasVendas = Object.entries(vendasDiaSabor)
        .sort(([,a],[,b]) => (b as number) - (a as number))
        .map(([d, q]) => `${diasSemana[Number(d)]}=${q}`)
        .join(", ");
      return `- ${s.nome}: estoque=${s.estoqueAtual}, média=${s.mediaDiaria}/dia, vendas7d=${s.vendas7d}, gelosPorLote=${s.gelosPorLote || 84}
  Vendas por dia: ${diasVendas || 'sem dados'}
  Histórico decisões: ${ultimas5.length > 0 ? ultimas5.map((h: any) => `${h.dia} ${h.data}: sug=${h.lotes_sugeridos}, aut=${h.lotes_autorizados}`).join('; ') : 'sem histórico'}
  Feedback 30d: planejado=${fb.planejado}, produzido=${fb.produzido}, vendido=${fb.vendido} ${fb.produzido > fb.vendido * 1.5 ? '⚠️EXCESSO' : fb.vendido > fb.produzido * 0.9 ? '⚠️DÉFICIT' : '✅EQUIL'}`;
    }).join("\n");

    const prompt = `Você é o assistente de produção semanal de uma fábrica de gelo saborizado em Boa Vista-RR.

VENDAS POR DIA DA SEMANA (últimos 30 dias):
${Object.entries(vendasPorDia).map(([d, q]) => `${diasSemana[Number(d)]}: ${q} un`).join("\n")}

SABORES (análise atual):
${saboresContext}

REGRAS:
- 1 lote = 84 unidades (padrão, mas cada sabor pode ter valor diferente em gelosPorLote)
- Sabores prioritários: Melancia, Maçã Verde, Morango, Maracujá, Água de Coco
- Distribua a produção de SEGUNDA a SEXTA (dias 1-5), sábado e domingo só se necessário
- Considere o padrão de vendas por dia da semana para distribuir melhor
- Considere feedback: se produz muito mais que vende, reduza; se vende mais que produz, aumente
- Seja conservador com sabores de baixa demanda
- Objetivo: cobrir a demanda da semana inteira mantendo estoque saudável (5-10 dias de cobertura)

Sugira um plano semanal completo distribuindo lotes por dia e por sabor.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um especialista em planejamento de produção semanal. Responda APENAS via tool calling." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_producao_semanal",
              description: "Suggest weekly production plan distributed by day and flavor",
              parameters: {
                type: "object",
                properties: {
                  plano: {
                    type: "array",
                    description: "Array of production items, each with day, flavor, and lots",
                    items: {
                      type: "object",
                      properties: {
                        dia_semana: { type: "number", description: "Day of week: 1=Monday, 2=Tuesday... 5=Friday, 6=Saturday, 0=Sunday" },
                        sabor_nome: { type: "string" },
                        lotes: { type: "number", description: "Number of lots to produce" },
                        confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                        justificativa: { type: "string", description: "Short reason in Portuguese, max 15 words" },
                      },
                      required: ["dia_semana", "sabor_nome", "lotes", "confianca", "justificativa"],
                      additionalProperties: false,
                    },
                  },
                  resumo: { type: "string", description: "Overall weekly production insight in Portuguese, max 40 words" },
                },
                required: ["plano", "resumo"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_producao_semanal" } },
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
    let result: any = { plano: [], resumo: "" };
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
    console.error("suggest-producao-semanal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
