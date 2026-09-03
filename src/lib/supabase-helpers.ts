import { supabase } from "@/integrations/supabase/client";

// Generic fetch helper with optional factory_id filter
export async function fetchAll(table: string, orderBy = "created_at", ascending = false, factoryId?: string | null) {
  let query = (supabase as any).from(table).select("*").order(orderBy, { ascending });
  if (factoryId) {
    query = query.eq("factory_id", factoryId);
  }
  const { data, error } = await query;
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
  p_ignorar_estoque?: boolean;
}) {
  const { data, error } = await supabase.rpc("realizar_venda" as any, {
    ...params,
    p_ignorar_estoque: params.p_ignorar_estoque ?? false,
  });
  if (error) throw error;
  return data;
}

/** Linha exibida no recibo (gelo saborizado, gelo cubo filtrado ou bebida). */
export interface ReciboItemLinha {
  sabor_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

/**
 * Busca TODOS os produtos de uma venda para o recibo: gelos saborizados,
 * gelo cubo filtrado e bebidas. Sem isso, vendas sem gelo saborizado
 * saem com a tabela vazia e total zerado.
 */
export async function fetchReciboItens(vendaId: string): Promise<ReciboItemLinha[]> {
  const client = supabase as any;
  const [gelos, cubos, bebidas] = await Promise.all([
    client.from("venda_itens").select("quantidade, preco_unitario, subtotal, sabores(nome)").eq("venda_id", vendaId),
    client.from("venda_gelo_cubo_itens").select("*").eq("venda_id", vendaId),
    client.from("venda_bebida_itens").select("*").eq("venda_id", vendaId),
  ]);

  const linhas: ReciboItemLinha[] = [];

  for (const it of gelos.data || []) {
    linhas.push({
      sabor_nome: it.sabores?.nome || "?",
      quantidade: Number(it.quantidade || 0),
      preco_unitario: Number(it.preco_unitario || 0),
      subtotal: Number(it.subtotal || 0),
    });
  }

  for (const it of cubos.data || []) {
    const qtd = Number(it.quantidade || 0);
    const unit = Number(it.preco_unitario ?? 0);
    linhas.push({
      sabor_nome: `Gelo Cubo Filtrado${it.tamanho ? ` ${it.tamanho}` : ""}`,
      quantidade: qtd,
      preco_unitario: unit,
      subtotal: Number(it.subtotal ?? unit * qtd),
    });
  }

  for (const it of bebidas.data || []) {
    const qtd = Number(it.quantidade || 0);
    const unit = Number(it.preco_unitario ?? 0);
    const nomeBase = String(it.nome || "Bebida");
    const sufixo = it.tipo_venda === "fardo" && !/\(fardo\)/i.test(nomeBase) ? " (Fardo)" : "";
    linhas.push({
      sabor_nome: `${nomeBase}${sufixo}`,
      quantidade: qtd,
      preco_unitario: unit,
      subtotal: Number(it.subtotal ?? unit * qtd),
    });
  }


  return linhas;
}
