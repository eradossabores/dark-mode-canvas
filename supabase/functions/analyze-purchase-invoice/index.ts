import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();

    if (!fileUrl) {
      throw new Error("Missing fileUrl");
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const prompt = `
      Você é um assistente especializado em extração de dados de notas fiscais e comprovantes de compra.
      Analise o arquivo no link abaixo e extraia:
      1. Nome do Fornecedor
      2. Data da Compra
      3. Itens comprados (nome, quantidade, valor unitário)
      4. Valor do Frete (se houver)
      5. Valor Final da nota

      Responda APENAS em formato JSON puro, sem markdown, seguindo esta estrutura:
      {
        "fornecedor": "nome",
        "data": "YYYY-MM-DD",
        "itens": [
          {"nome": "produto A", "quantidade": 10, "valor_unitario": 5.0}
        ],
        "valor_frete": 0.0,
        "valor_total": 50.0
      }
    `;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: fileUrl } }
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Clean up potential markdown code blocks if the model ignored instructions
    const jsonString = content.replace(/```json\n?|\n?```/g, "").trim();
    const extractedData = JSON.parse(jsonString);

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
