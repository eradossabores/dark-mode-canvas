import { supabase } from "@/integrations/supabase/client";

// Generic fetch helper
export async function fetchAll(table: string, orderBy = "created_at", ascending = false) {
  const { data, error } = await (supabase as any).from(table).select("*").order(orderBy, { ascending });
  if (error) throw error;
  return data;
}

export async function fetchById(table: string, id: string) {
  const { data, error } = await (supabase as any).from(table).select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function insertRow(table: string, row: any) {
  const { data, error } = await (supabase as any).from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table: string, id: string, updates: any) {
  const { data, error } = await (supabase as any).from(table).update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table: string, id: string) {
  const { error } = await (supabase as any).from(table).delete().eq("id", id);
  if (error) throw error;
}

// RPC helpers for transactional operations
export async function realizarProducao(params: {
  p_sabor_id: string;
  p_modo: string;
  p_quantidade_lotes: number;
  p_quantidade_total: number;
  p_operador: string;
  p_observacoes: string;
  p_funcionarios: { funcionario_id: string; quantidade_produzida: number }[];
  p_ignorar_estoque?: boolean;
}) {
  const { data, error } = await supabase.rpc("realizar_producao" as any, {
    ...params,
    p_ignorar_estoque: params.p_ignorar_estoque ?? false,
  });
  if (error) throw error;
  return data;
}

export async function realizarVenda(params: {
  p_cliente_id: string;
  p_operador: string;
  p_observacoes: string;
  p_itens: { sabor_id: string; quantidade: number }[];
  p_parcelas?: { valor: number; vencimento: string }[] | null;
}) {
  const { data, error } = await supabase.rpc("realizar_venda" as any, params);
  if (error) throw error;
  return data;
}
