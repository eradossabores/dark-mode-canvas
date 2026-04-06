import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NFE_API_BASE = "https://api.nfse.io/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { nf_id } = body;

    if (!nf_id) {
      return new Response(JSON.stringify({ error: "nf_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get NF record
    const { data: nf, error: nfError } = await supabase
      .from("notas_fiscais")
      .select("*, factories(nfe_api_key, nfe_company_id)")
      .eq("id", nf_id)
      .single();

    if (nfError || !nf) {
      return new Response(JSON.stringify({ error: "NF não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nf.nfe_io_id || !nf.factories?.nfe_api_key || !nf.factories?.nfe_company_id) {
      return new Response(JSON.stringify({ error: "Dados insuficientes para consulta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query NFE.io for status
    const nfeResponse = await fetch(
      `${NFE_API_BASE}/companies/${nf.factories.nfe_company_id}/productinvoices/${nf.nfe_io_id}`,
      {
        headers: {
          Authorization: nf.factories.nfe_api_key,
        },
      }
    );

    if (!nfeResponse.ok) {
      const errText = await nfeResponse.text();
      return new Response(JSON.stringify({ error: "Erro ao consultar NFE.io", details: errText }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nfeData = await nfeResponse.json();

    // Map NFE.io status to our status
    let newStatus = nf.status;
    if (nfeData.flowStatus === "Issued" || nfeData.flowStatus === "IssuedFiscalDocument") {
      newStatus = "autorizada";
    } else if (nfeData.flowStatus === "Cancelled" || nfeData.flowStatus === "CancelledFiscalDocument") {
      newStatus = "cancelada";
    } else if (nfeData.flowStatus === "IssueFailed" || nfeData.flowStatus === "CancelFailed") {
      newStatus = "erro";
    }

    // Build PDF/XML URLs
    const pdfUrl = nfeData.id
      ? `${NFE_API_BASE}/companies/${nf.factories.nfe_company_id}/productinvoices/${nfeData.id}/pdf`
      : null;
    const xmlUrl = nfeData.id
      ? `${NFE_API_BASE}/companies/${nf.factories.nfe_company_id}/productinvoices/${nfeData.id}/xml`
      : null;

    // Update local record
    await supabase
      .from("notas_fiscais")
      .update({
        status: newStatus,
        numero: nfeData.number?.toString() || nf.numero,
        serie: nfeData.serie?.toString() || nf.serie,
        chave_acesso: nfeData.accessKey || nf.chave_acesso,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
        erro_mensagem: nfeData.flowStatus?.includes("Failed")
          ? nfeData.flowMessage || "Falha na emissão"
          : null,
      })
      .eq("id", nf_id);

    return new Response(
      JSON.stringify({
        status: newStatus,
        numero: nfeData.number,
        chave_acesso: nfeData.accessKey,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
