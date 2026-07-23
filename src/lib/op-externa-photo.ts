import { supabase } from "@/integrations/supabase/client";

export const OP_BUCKET = "operacao-externa";

export async function uploadOpFoto(path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(OP_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export async function getOpFotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(OP_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}