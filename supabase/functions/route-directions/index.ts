import { corsHeaders } from "@supabase/supabase-js/cors";

const OSRM_SERVERS = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-car",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { from, to } = await req.json();

    if (
      !from || !to ||
      typeof from[0] !== "number" || typeof from[1] !== "number" ||
      typeof to[0] !== "number" || typeof to[1] !== "number"
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid coordinates. Expected {from: [lat,lng], to: [lat,lng]}" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const coordsStr = `${from[1]},${from[0]};${to[1]},${to[0]}`;

    for (const server of OSRM_SERVERS) {
      try {
        const url = `${server}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "IceTech-Routing/1.0" },
        });
        clearTimeout(timeout);

        if (!res.ok) continue;

        const data = await res.json();

        if (data.code === "Ok" && data.routes?.[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);

          return new Response(
            JSON.stringify({
              coords,
              distanceKm: Math.round((route.distance / 1000) * 10) / 10,
              durationMin: Math.round(route.duration / 60),
              source: "osrm",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.warn(`OSRM server ${server} failed:`, e.message);
      }
    }

    // All servers failed - return error so client knows to retry or show fallback
    return new Response(
      JSON.stringify({ error: "routing_unavailable", message: "All routing servers are currently unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
