import { describe, expect, it } from "vitest";
import { analisarRecorrencia, VendaRecorrenciaRaw } from "@/components/relatorios/recorrencia-analysis";

const vendas: VendaRecorrenciaRaw[] = [
  {
    id: "v1",
    cliente_id: "c1",
    created_at: "2026-08-01T12:00:00-03:00",
    numero_pedido: 1,
    total: 100,
    venda_itens: [{ quantidade: 10, sabores: { nome: "Morango" } }],
    venda_bebida_itens: [],
    venda_gelo_cubo_itens: [],
  },
  {
    id: "v2",
    cliente_id: "c1",
    created_at: "2026-08-11T12:00:00-03:00",
    numero_pedido: 2,
    total: 250,
    venda_itens: [{ quantidade: 5, sabores: { nome: "Morango" } }],
    venda_bebida_itens: [{ nome: "Busca Brisa", quantidade: 2, tipo_venda: "fardo", bebidas: { unidades_fardo: 6 } }],
    venda_gelo_cubo_itens: [{ quantidade: 3, tamanho: "3kg" }],
  },
];

describe("analisarRecorrencia", () => {
  it("calcula intervalo, previsão e unidades reais de fardos", () => {
    const [cliente] = analisarRecorrencia([{ id: "c1", nome: "Cliente A" }], vendas, new Date("2026-08-19T12:00:00-03:00"));

    expect(cliente.frequenciaMedia).toBe(10);
    expect(cliente.totalUnidades).toBe(30);
    expect(cliente.mediaUnidades).toBe(15);
    expect(cliente.status).toBe("em_breve");
    expect(cliente.diasParaProxima).toBe(2);
    expect(cliente.produtosFavoritos[0]).toEqual({ nome: "Morango", quantidade: 15 });
    expect(cliente.compras[1].intervaloAnterior).toBe(10);
  });

  it("marca como atrasado quando ultrapassa o ciclo esperado", () => {
    const [cliente] = analisarRecorrencia([{ id: "c1", nome: "Cliente A" }], vendas, new Date("2026-08-25T12:00:00-03:00"));

    expect(cliente.status).toBe("atrasado");
    expect(cliente.diasAtraso).toBe(4);
  });

  it("ignora clientes sem compras e classifica compra única como nova", () => {
    const resultado = analisarRecorrencia(
      [{ id: "c1", nome: "Cliente A" }, { id: "c2", nome: "Sem compra" }],
      vendas.slice(0, 1),
      new Date("2026-08-05T12:00:00-03:00"),
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].status).toBe("novo");
    expect(resultado[0].proximaCompra).toBeNull();
  });
});