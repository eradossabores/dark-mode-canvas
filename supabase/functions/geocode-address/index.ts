import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type GeocodeBody = {
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

function normalizePart(value?: string) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function buildQueries({ endereco, bairro, cidade, estado }: GeocodeBody) {
  const cidadeVal = normalizePart(cidade) || "Boa Vista";
  const estadoVal = normalizePart(estado) || "RR";
  const enderecoVal = normalizePart(endereco);
  const bairroVal = normalizePart(bairro);

  return [
    [enderecoVal, bairroVal, cidadeVal, estadoVal, "Brasil"].filter(Boolean).join(", "),
    [enderecoVal, cidadeVal, estadoVal, "Brasil"].filter(Boolean).join(", "),
    [bairroVal, cidadeVal, estadoVal, "Brasil"].filter(Boolean).join(", "),
  ].filter((query, index, list) => Boolean(query) && list.indexOf(query) === index);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    // ---- AUTH CHECK ----
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
    // ---- END AUTH CHECK ----

    const body = (await req.json()) as GeocodeBody;
    const endereco = normalizePart(body.endereco);

    if (!endereco) {
      return new Response(JSON.stringify({ coords: null, reason: "endereco_required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queries = buildQueries(body);

    for (const query of queries) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`,
          {
            headers: {
              "User-Agent": "A Era dos Sabores - Lovable Cloud",
              "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            },
          },
        );

        if (!response.ok) continue;

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          return new Response(
            JSON.stringify({
              coords: { lat: Number(data[0].lat), lng: Number(data[0].lon) },
              query_used: query,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("geocode-address query failed", query, error);
      }
    }

    return new Response(JSON.stringify({ coords: null, reason: "not_found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("geocode-address error", error);

    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
