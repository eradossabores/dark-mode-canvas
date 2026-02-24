import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospecto, visita } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um especialista em vendas B2B de gelos saborizados premium para o mercado de Boa Vista-RR.
Sua tarefa é gerar uma mensagem de follow-up comercial personalizada para enviar ao cliente 5 dias após uma visita comercial.

REGRAS:
- A mensagem deve ser em português brasileiro
- Máximo 300 palavras
- Incluir o nome do estabelecimento
- Adaptar o tom conforme o perfil:
  * Bar popular → linguagem simples, foco em giro rápido e aceitação do público
  * Casa premium/lounge → linguagem sofisticada, foco em experiência e valor agregado
  * Distribuidora → foco em volume, recorrência e margem de revenda
  * Eventos/buffet → foco em impacto visual e diferenciação
  * Tabacaria → foco em drinks diferenciados e experiência
  * Restaurante → foco em cardápio de drinks e ticket médio
  * Lanchonete/mercado → foco em praticidade e preço competitivo
- Incluir um CTA claro (call to action)
- Ser natural, não parecer robótico
- Considerar o feedback da visita anterior

Retorne APENAS a mensagem, sem aspas, sem prefixos como "Mensagem:" ou similares.`;

    const userPrompt = `Dados do prospecto:
- Nome: ${prospecto.nome}
- Tipo: ${prospecto.tipo}
- Bairro: ${prospecto.bairro || "não informado"}
- Score (1-5): ${prospecto.score}
- Prioridade: ${prospecto.prioridade}
- Perfil do público: ${prospecto.perfil_publico || "não informado"}
- Volume potencial: ${prospecto.volume_potencial || "não informado"}
- Observações estratégicas: ${prospecto.observacoes_estrategicas || "nenhuma"}
- Contato: ${prospecto.contato_nome || "responsável"}

Dados da última visita:
- Resultado: ${visita.resultado}
- Produto apresentado: ${visita.produto_apresentado || "gelos saborizados"}
- Feedback do cliente: ${visita.feedback || "sem feedback registrado"}
- Próxima ação sugerida: ${visita.proxima_acao || "não definida"}

Gere a mensagem de follow-up personalizada.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar mensagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const mensagem = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ mensagem }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-followup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
