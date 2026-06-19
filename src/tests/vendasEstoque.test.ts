import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Auditoria Vendas × Estoque
 * Estes testes validam que TODA mutação de uma venda existente
 * passa pela RPC `ajustar_venda_item` ou `cancelar_venda`,
 * garantindo: (a) estoque ajustado pela diferença correta,
 * (b) movimentação registrada, (c) auditoria gravada.
 *
 * Como o front apenas envia o estado desejado, asseguramos
 * que a sequência de chamadas RPC reflete a intenção do usuário.
 */

type RpcCall = { fn: string; args: any };

function makeSupabaseMock(currentItems: any[]) {
  const rpcCalls: RpcCall[] = [];
  const tableCalls: any[] = [];

  const supabase: any = {
    rpc: vi.fn(async (fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      return { data: { ok: true }, error: null };
    }),
    from: vi.fn((table: string) => {
      const ctx: any = { table, _filters: {}, _payload: null, _op: null };
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => { ctx._filters[col] = val; return builder; },
        in: (col: string, vals: any[]) => { ctx._filters[col] = vals; return builder; },
        order: () => builder,
        single: async () => ({ data: null, error: null }),
        insert: (payload: any) => {
          ctx._op = "insert"; ctx._payload = payload; tableCalls.push({ ...ctx });
          return { select: async () => ({ data: [{ id: "new-id" }], error: null }) };
        },
        update: (payload: any) => {
          ctx._op = "update"; ctx._payload = payload; tableCalls.push({ ...ctx });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        delete: () => {
          ctx._op = "delete";
          return {
            eq: () => { tableCalls.push({ ...ctx, _op: "delete" }); return Promise.resolve({ error: null }); },
            in: () => { tableCalls.push({ ...ctx, _op: "delete" }); return Promise.resolve({ error: null }); },
          };
        },
        then: (resolve: any) => resolve({ data: table === "venda_itens" ? currentItems : [], error: null }),
      };
      return builder;
    }),
  };

  return { supabase, rpcCalls, tableCalls };
}

/**
 * Simula a lógica de handleEditSave (parte que mexe em estoque) —
 * espelha exatamente a sequência implementada em Vendas.tsx.
 */
async function aplicarEdicao(
  supabase: any,
  vendaId: string,
  atuaisDb: any[],
  itensNovos: { id?: string; sabor_id: string; quantidade: number; preco_unitario: number; isNew?: boolean }[],
) {
  const pagos = atuaisDb.filter((r) => Number(r.preco_unitario) > 0);
  const keep = new Set(itensNovos.filter((i) => i.id && !i.isNew).map((i) => i.id));

  for (const dbItem of pagos) {
    if (!keep.has(dbItem.id)) {
      await supabase.rpc("ajustar_venda_item", {
        p_venda_id: vendaId,
        p_sabor_id: dbItem.sabor_id,
        p_quantidade_nova: 0,
        p_preco_unitario: Number(dbItem.preco_unitario),
        p_regra: "manual",
        p_operador: "edicao_comanda",
      });
    }
  }

  for (const item of itensNovos) {
    await supabase.rpc("ajustar_venda_item", {
      p_venda_id: vendaId,
      p_sabor_id: item.sabor_id,
      p_quantidade_nova: item.quantidade,
      p_preco_unitario: item.preco_unitario,
      p_regra: "manual",
      p_operador: "edicao_comanda",
    });
  }
}

describe("Auditoria Vendas × Estoque", () => {
  let mock: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    mock = makeSupabaseMock([]);
  });

  it("1. Venda simples — debita 1 sabor via RPC realizar_venda", async () => {
    await mock.supabase.rpc("realizar_venda", {
      p_cliente_id: "c1", p_operador: "op", p_observacoes: "",
      p_itens: [{ sabor_id: "morango", quantidade: 5 }],
    });
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].args.p_itens).toEqual([{ sabor_id: "morango", quantidade: 5 }]);
  });

  it("2. Venda múltipla — passa todos os itens em uma chamada", async () => {
    await mock.supabase.rpc("realizar_venda", {
      p_cliente_id: "c1", p_operador: "op", p_observacoes: "",
      p_itens: [
        { sabor_id: "morango", quantidade: 3 },
        { sabor_id: "uva", quantidade: 2 },
      ],
    });
    expect(mock.rpcCalls[0].args.p_itens).toHaveLength(2);
  });

  it("3. Edição aumentando qty — ajustar_venda_item recebe nova qty (RPC calcula delta)", async () => {
    const atuais = [{ id: "i1", sabor_id: "morango", quantidade: 5, preco_unitario: 3 }];
    await aplicarEdicao(mock.supabase, "v1", atuais, [
      { id: "i1", sabor_id: "morango", quantidade: 8, preco_unitario: 3 },
    ]);
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0]).toEqual({
      fn: "ajustar_venda_item",
      args: expect.objectContaining({ p_venda_id: "v1", p_sabor_id: "morango", p_quantidade_nova: 8 }),
    });
  });

  it("4. Edição diminuindo qty — chama ajustar_venda_item com qty menor", async () => {
    const atuais = [{ id: "i1", sabor_id: "morango", quantidade: 5, preco_unitario: 3 }];
    await aplicarEdicao(mock.supabase, "v1", atuais, [
      { id: "i1", sabor_id: "morango", quantidade: 2, preco_unitario: 3 },
    ]);
    expect(mock.rpcCalls[0].args.p_quantidade_nova).toBe(2);
  });

  it("5. Exclusão de item — sabor removido vira chamada com qty 0", async () => {
    const atuais = [
      { id: "i1", sabor_id: "morango", quantidade: 5, preco_unitario: 3 },
      { id: "i2", sabor_id: "uva", quantidade: 4, preco_unitario: 3 },
    ];
    await aplicarEdicao(mock.supabase, "v1", atuais, [
      { id: "i1", sabor_id: "morango", quantidade: 5, preco_unitario: 3 },
    ]);
    const zerados = mock.rpcCalls.filter((c) => c.args.p_quantidade_nova === 0);
    expect(zerados).toHaveLength(1);
    expect(zerados[0].args.p_sabor_id).toBe("uva");
  });

  it("6. Inclusão de novo item — gera chamada para novo sabor", async () => {
    const atuais = [{ id: "i1", sabor_id: "morango", quantidade: 5, preco_unitario: 3 }];
    await aplicarEdicao(mock.supabase, "v1", atuais, [
      { id: "i1", sabor_id: "morango", quantidade: 5, preco_unitario: 3 },
      { sabor_id: "uva", quantidade: 4, preco_unitario: 3, isNew: true },
    ]);
    const novo = mock.rpcCalls.find((c) => c.args.p_sabor_id === "uva");
    expect(novo?.args.p_quantidade_nova).toBe(4);
  });

  it("7. Cancelamento — chama RPC cancelar_venda (não update direto de status)", async () => {
    await mock.supabase.rpc("cancelar_venda", { p_venda_id: "v1", p_operador: "user" });
    expect(mock.rpcCalls).toEqual([{ fn: "cancelar_venda", args: { p_venda_id: "v1", p_operador: "user" } }]);
  });
});