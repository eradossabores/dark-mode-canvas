import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type GeocodeBody = {
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

function norm(value?: string) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

const ESTADO_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina",
  SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

async function nominatimSearch(params: Record<string, string>): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "GeloSaborizado-Lovable/1.0",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  }
  return null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { error: authErr } = await client.auth.getUser();
    if (authErr) return json({ error: "Não autorizado" }, 401);

    const body = (await req.json()) as GeocodeBody;
    const endereco = norm(body.endereco);
    if (!endereco) return json({ coords: null, reason: "endereco_required" });

    const cidade = norm(body.cidade) || "Boa Vista";
    const estadoSigla = norm(body.estado) || "RR";
    const estadoNome = ESTADO_NOME[estadoSigla.toUpperCase()] || estadoSigla;
    const bairro = norm(body.bairro);

    // Strategy 1: Structured query (most precise)
    let coords = await nominatimSearch({
      street: endereco,
      city: cidade,
      state: estadoNome,
      country: "Brazil",
    });
    if (coords) return json({ coords, query_used: "structured_street" });

    // Strategy 2: Structured without number (street name only)
    const streetNoNumber = endereco.replace(/,?\s*\d+\s*(-\s*\w+)?$/, "").trim();
    if (streetNoNumber !== endereco) {
      coords = await nominatimSearch({
        street: streetNoNumber,
        city: cidade,
        state: estadoNome,
        country: "Brazil",
      });
      if (coords) return json({ coords, query_used: "structured_street_no_number" });
    }

    // Strategy 3: Free-form with full address + bairro
    const freeQuery = [endereco, bairro, cidade, estadoNome, "Brasil"].filter(Boolean).join(", ");
    coords = await nominatimSearch({ q: freeQuery });
    if (coords) return json({ coords, query_used: "freeform_full" });

    // Strategy 4: Free-form without bairro
    const freeQuery2 = [endereco, cidade, estadoNome, "Brasil"].filter(Boolean).join(", ");
    coords = await nominatimSearch({ q: freeQuery2 });
    if (coords) return json({ coords, query_used: "freeform_no_bairro" });

    // Strategy 5: Bairro + city fallback
    if (bairro) {
      coords = await nominatimSearch({ q: [bairro, cidade, estadoNome].join(", ") });
      if (coords) return json({ coords, query_used: "bairro_fallback" });
    }

    return json({ coords: null, reason: "not_found" });
  } catch (error) {
    console.error("geocode-address error", error);
    return json({ error: "Erro interno" }, 500);
  }
});
