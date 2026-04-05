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
    const { data: claimsData, error: claimsError } = await callerClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sabores_analise, factory_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical decisions (last 30 days - focused window)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let qDecisoes = supabase
      .from("decisoes_producao")
      .select("*")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });
    if (factory_id) qDecisoes = qDecisoes.eq("factory_id", factory_id);
    const { data: decisoes } = await qDecisoes;

    // Fetch recent sales (last 30 days)
    let qVendaItens = supabase
      .from("venda_itens")
      .select("sabor_id, quantidade, venda_id, vendas!inner(created_at, status, factory_id)")
      .gte("vendas.created_at", thirtyDaysAgo.toISOString())
      .neq("vendas.status", "cancelada");
    if (factory_id) qVendaItens = qVendaItens.eq("vendas.factory_id", factory_id);
    const { data: vendaItens } = await qVendaItens;

    // Fetch recent production (last 30 days)
    let qProd = supabase
      .from("producoes")
      .select("sabor_id, quantidade_total, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString());
    if (factory_id) qProd = qProd.eq("factory_id", factory_id);
    const { data: producoes } = await qProd;

    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    
    // Sales by day of week and by week number
    const vendasPorDia: Record<number, number> = {};
    const vendasPorDiaSabor: Record<string, Record<number, number>> = {};
    const vendasPorSemana: Record<string, Record<string, number>> = {}; // week -> sabor_id -> qty
    
    (vendaItens || []).forEach((v: any) => {
      const dt = new Date(v.vendas?.created_at);
      const dia = dt.getDay();
      vendasPorDia[dia] = (vendasPorDia[dia] || 0) + v.quantidade;
      if (!vendasPorDiaSabor[v.sabor_id]) vendasPorDiaSabor[v.sabor_id] = {};
      vendasPorDiaSabor[v.sabor_id][dia] = (vendasPorDiaSabor[v.sabor_id][dia] || 0) + v.quantidade;
      
      // Group by ISO week
      const weekStart = new Date(dt);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);
      const weekKey = weekStart.toISOString().slice(0, 10);
      if (!vendasPorSemana[weekKey]) vendasPorSemana[weekKey] = {};
      vendasPorSemana[weekKey][v.sabor_id] = (vendasPorSemana[weekKey][v.sabor_id] || 0) + v.quantidade;
    });

    // Analyze decision patterns: how the user prioritizes
    const decisoesPorSabor: Record<string, any[]> = {};
    const padraoDecisao: Record<string, { totalSugerido: number; totalAutorizado: number; vezesAumentou: number; vezesReduziu: number; vezesManteve: number }> = {};
    
    (decisoes || []).forEach((d: any) => {
      if (!decisoesPorSabor[d.sabor_nome]) decisoesPorSabor[d.sabor_nome] = [];
      decisoesPorSabor[d.sabor_nome].push({
        dia: diasSemana[d.dia_semana],
        lotes_sugeridos: d.lotes_sugeridos,
        lotes_autorizados: d.lotes_autorizados,
        ajuste: d.lotes_autorizados - d.lotes_sugeridos,
        estoque: d.estoque_no_momento,
        vendas_7d: d.vendas_7d,
        media_diaria: d.media_diaria,
        data: d.created_at.slice(0, 10),
      });
      
      // Track decision patterns
      if (!padraoDecisao[d.sabor_nome]) {
        padraoDecisao[d.sabor_nome] = { totalSugerido: 0, totalAutorizado: 0, vezesAumentou: 0, vezesReduziu: 0, vezesManteve: 0 };
      }
      const p = padraoDecisao[d.sabor_nome];
      p.totalSugerido += d.lotes_sugeridos;
      p.totalAutorizado += d.lotes_autorizados;
      if (d.lotes_autorizados > d.lotes_sugeridos) p.vezesAumentou++;
      else if (d.lotes_autorizados < d.lotes_sugeridos) p.vezesReduziu++;
      else p.vezesManteve++;
    });

    // Production vs Sales feedback per sabor
    const feedbackPorSabor: Record<string, { planejado: number; produzido: number; vendido: number }> = {};
    (sabores_analise || []).forEach((s: any) => {
      const planejado = (decisoesPorSabor[s.nome] || [])
        .reduce((sum: number, d: any) => sum + d.lotes_autorizados * (s.gelosPorLote || 84), 0);
      const produzido = (producoes || [])
        .filter((p: any) => p.sabor_id === s.id)
        .reduce((sum: number, p: any) => sum + p.quantidade_total, 0);
      const vendido = (vendaItens || [])
        .filter((v: any) => v.sabor_id === s.id)
        .reduce((sum: number, v: any) => sum + v.quantidade, 0);
      feedbackPorSabor[s.nome] = { planejado, produzido, vendido };
    });

    // Weekly sales trend per sabor (to detect rising/falling demand)
    const weekKeys = Object.keys(vendasPorSemana).sort();
    const tendenciaSabor: Record<string, string> = {};
    (sabores_analise || []).forEach((s: any) => {
      if (weekKeys.length >= 2) {
        const lastWeek = vendasPorSemana[weekKeys[weekKeys.length - 1]]?.[s.id] || 0;
        const prevWeek = vendasPorSemana[weekKeys[weekKeys.length - 2]]?.[s.id] || 0;
        if (lastWeek > prevWeek * 1.2) tendenciaSabor[s.nome] = "📈 CRESCENDO";
        else if (lastWeek < prevWeek * 0.8) tendenciaSabor[s.nome] = "📉 CAINDO";
        else tendenciaSabor[s.nome] = "➡️ ESTÁVEL";
      } else {
        tendenciaSabor[s.nome] = "➡️ SEM DADOS SUFICIENTES";
      }
    });

    const saboresContext = (sabores_analise || []).map((s: any) => {
      const hist = decisoesPorSabor[s.nome] || [];
      const fb = feedbackPorSabor[s.nome] || { planejado: 0, produzido: 0, vendido: 0 };
      const padrao = padraoDecisao[s.nome];
      const ultimas5 = hist.slice(0, 5);
      const vendasDiaSabor = vendasPorDiaSabor[s.id] || {};
      const diasVendas = Object.entries(vendasDiaSabor)
        .sort(([,a],[,b]) => (b as number) - (a as number))
        .map(([d, q]) => `${diasSemana[Number(d)]}=${q}`)
        .join(", ");
      
      const padraoStr = padrao 
        ? `Padrão decisório: sugerido=${padrao.totalSugerido}lotes, autorizado=${padrao.totalAutorizado}lotes, aumentou=${padrao.vezesAumentou}x, reduziu=${padrao.vezesReduziu}x, manteve=${padrao.vezesManteve}x`
        : 'Sem histórico de decisões';
      
      return `- ${s.nome}: estoque=${s.estoqueAtual}, média=${s.mediaDiaria}/dia, vendas7d=${s.vendas7d}, gelosPorLote=${s.gelosPorLote || 84}
  Tendência: ${tendenciaSabor[s.nome] || 'sem dados'}
  Vendas por dia (30d): ${diasVendas || 'sem dados'}
  ${padraoStr}
  Histórico recente: ${ultimas5.length > 0 ? ultimas5.map((h: any) => `${h.dia} ${h.data}: sug=${h.lotes_sugeridos}, aut=${h.lotes_autorizados}, est=${h.estoque}`).join('; ') : 'sem histórico'}
  Feedback 30d: planejado=${fb.planejado}, produzido=${fb.produzido}, vendido=${fb.vendido} ${fb.produzido > fb.vendido * 1.5 ? '⚠️EXCESSO' : fb.vendido > fb.produzido * 0.9 ? '⚠️DÉFICIT' : '✅EQUIL'}`;
    }).join("\n");

    const prompt = `Você é o assistente de produção semanal de uma fábrica de gelo saborizado em Boa Vista-RR.

IMPORTANTE: Analise os últimos 30 dias de decisões do gestor para APRENDER o padrão de tomada de decisão dele:
- O gestor geralmente PRIORIZA a produção dos sabores que MAIS SAÍRAM na semana
- Ele olha o ESTOQUE ATUAL e dá prioridade aos sabores com estoque mais baixo em relação à demanda
- Use o "Padrão decisório" de cada sabor para entender se o gestor costuma aumentar, reduzir ou manter as sugestões
- Respeite a tendência de cada sabor (crescendo, caindo, estável)

VENDAS POR DIA DA SEMANA (últimos 30 dias):
${Object.entries(vendasPorDia).map(([d, q]) => `${diasSemana[Number(d)]}: ${q} un`).join("\n")}

TENDÊNCIA SEMANAL:
${weekKeys.length >= 2 ? weekKeys.slice(-3).map(w => {
  const weekSales = vendasPorSemana[w];
  const total = Object.values(weekSales).reduce((s, v) => s + v, 0);
  return `Semana ${w}: ${total} un total`;
}).join("\n") : 'Dados insuficientes'}

SABORES (análise completa dos últimos 30 dias):
${saboresContext}

REGRAS DE DECISÃO (aprenda com o gestor):
- 1 lote = quantidade específica de cada sabor (veja gelosPorLote)
- PRIORIZE os sabores com MAIOR SAÍDA e MENOR ESTOQUE relativo à demanda
- Se o gestor historicamente AUMENTOU lotes de um sabor, sugira mais para ele
- Se o gestor historicamente REDUZIU, seja mais conservador
- Distribua de SEGUNDA a SEXTA (dias 1-5), sábado/domingo só se necessário
- Considere o padrão de vendas por dia da semana para distribuir melhor
- Objetivo: cobrir a demanda da semana inteira mantendo estoque saudável (5-10 dias de cobertura)
- Sabores com tendência 📈 CRESCENDO devem receber mais lotes
- Sabores com tendência 📉 CAINDO devem receber menos lotes

Sugira um plano semanal que IMITE as decisões do gestor com base nos padrões dos últimos 30 dias.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um especialista em planejamento de produção semanal. Analise o histórico de 30 dias de decisões do gestor para replicar seu estilo de tomada de decisão. Responda APENAS via tool calling." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_producao_semanal",
              description: "Suggest weekly production plan distributed by day and flavor, based on 30-day decision analysis",
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
                        justificativa: { type: "string", description: "Short reason in Portuguese referencing the 30-day analysis, max 20 words" },
                      },
                      required: ["dia_semana", "sabor_nome", "lotes", "confianca", "justificativa"],
                      additionalProperties: false,
                    },
                  },
                  resumo: { type: "string", description: "Overall weekly insight based on 30-day decision patterns, in Portuguese, max 50 words" },
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
