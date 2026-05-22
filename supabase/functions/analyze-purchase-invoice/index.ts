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

    // Determine if it's a PDF or image by extension
    const isPdf = fileUrl.toLowerCase().split('?')[0].endsWith('.pdf');
    
    let contentObj;
    if (isPdf) {
      // PDF handling - Gemini 1.5 Pro via Gateway supports PDFs if sent correctly
      // But to be safe and simple for now, we'll try to let the gateway handle the URL
      contentObj = { type: "text", text: `Analise este arquivo (PDF): ${fileUrl}` };
    } else {
      // For images, use data URL as suggested by the error message
      try {
        console.log("Fetching image from:", fileUrl);
        const imageRes = await fetch(fileUrl);
        if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.statusText}`);
        
        const imageBlob = await imageRes.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        
        // Use standard btoa for base64 encoding in Deno
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);
        
        const mimeType = imageBlob.type || "image/png";
        console.log("Image converted to base64, mimeType:", mimeType);
        
        contentObj = { 
          type: "image_url", 
          image_url: { url: `data:${mimeType};base64,${base64}` } 
        };
      } catch (e) {
        console.error("Error converting image to base64:", e.message);
        // Fallback to URL and hope for the best
        contentObj = { type: "image_url", image_url: { url: fileUrl } };
      }
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
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              contentObj

            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    console.log("AI Gateway response:", JSON.stringify(data));

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Unexpected AI response structure:", data);
      throw new Error("Erro na resposta da IA: Estrutura inválida ou limite atingido.");
    }

    const content = data.choices[0].message.content;
    
    // Clean up potential markdown code blocks if the model ignored instructions
    const jsonString = content.replace(/```json\n?|\n?```/g, "").trim();
    let extractedData;
    try {
      extractedData = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse AI content as JSON:", content);
      throw new Error("A IA não retornou um formato JSON válido.");
    }

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

});
