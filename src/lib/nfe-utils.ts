import { supabase } from "@/integrations/supabase/client";

export async function emitirNfeAutomatica(vendaId: string, factoryId: string) {
  try {
    // Check if factory has NFE enabled
    const { data: factory } = await (supabase as any)
      .from("factories")
      .select("emite_nfe")
      .eq("id", factoryId)
      .single();

    if (!factory?.emite_nfe) return null;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return null;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/emit-nfe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ venda_id: vendaId, factory_id: factoryId }),
      }
    );

    const result = await res.json();
    if (!res.ok) {
      console.warn("NF-e emission failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  } catch (e: any) {
    console.error("NF-e auto emission error:", e);
    return { success: false, error: e.message };
  }
}
