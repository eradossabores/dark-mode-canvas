import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const OSRM_SERVERS = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-car",
];

const VALHALLA_SERVER = "https://valhalla1.openstreetmap.de";

async function tryOSRM(from: [number, number], to: [number, number]): Promise<any | null> {
  const coordsStr = `${from[1]},${from[0]};${to[1]},${to[0]}`;

  for (const server of OSRM_SERVERS) {
    try {
      const url = `${server}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

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
        if (coords.length >= 2) {
          return {
            coords,
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            durationMin: Math.round(route.duration / 60),
            source: "osrm",
          };
        }
      }
    } catch (e) {
      console.warn(`OSRM ${server} failed:`, e.message);
    }
  }
  return null;
}

async function tryValhalla(from: [number, number], to: [number, number]): Promise<any | null> {
  try {
    const body = {
      locations: [
        { lat: from[0], lon: from[1] },
        { lat: to[0], lon: to[1] },
      ],
      costing: "auto",
      units: "km",
      shape_match: "map_snap",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${VALHALLA_SERVER}/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "IceTech-Routing/1.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    if (data.trip?.legs?.[0]) {
      const leg = data.trip.legs[0];
      // Valhalla returns encoded polyline in shape
      const coords = decodeValhallaShape(leg.shape);
      if (coords.length >= 2) {
        return {
          coords,
          distanceKm: Math.round(data.trip.summary.length * 10) / 10,
          durationMin: Math.round(data.trip.summary.time / 60),
          source: "valhalla",
        };
      }
    }
  } catch (e) {
    console.warn("Valhalla failed:", e.message);
  }
  return null;
}

// Decode Valhalla's encoded polyline (precision 6)
function decodeValhallaShape(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lat / 1e6, lng / 1e6]);
  }

  return coords;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  try {
    const { from, to } = await req.json();

    if (
      !from || !to ||
      typeof from[0] !== "number" || typeof from[1] !== "number" ||
      typeof to[0] !== "number" || typeof to[1] !== "number"
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid coordinates" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Try OSRM first, then Valhalla
    const result = await tryOSRM(from, to) || await tryValhalla(from, to);

    if (result) {
      return new Response(
        JSON.stringify(result),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "routing_unavailable" }),
      { status: 503, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
