import { supabase } from "@/integrations/supabase/client";

export interface ClienteGeocodeInput {
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface ClienteCoordinates {
  lat: number;
  lng: number;
}

export function hasAddressForGeocoding(input: ClienteGeocodeInput) {
  return Boolean(input.endereco?.trim());
}

export async function geocodeClienteAddress(input: ClienteGeocodeInput): Promise<ClienteCoordinates | null> {
  if (!hasAddressForGeocoding(input)) return null;

  const { data, error } = await supabase.functions.invoke("geocode-address", {
    body: {
      endereco: input.endereco?.trim() || "",
      bairro: input.bairro?.trim() || "",
      cidade: input.cidade?.trim() || "Boa Vista",
      estado: input.estado?.trim() || "RR",
    },
  });

  if (error) throw error;

  if (!data?.coords) return null;

  return {
    lat: Number(data.coords.lat),
    lng: Number(data.coords.lng),
  };
}