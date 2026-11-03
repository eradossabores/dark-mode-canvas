import { describe, expect, it } from "vitest";
import { agruparVendas, topSabores, vendasValidas } from "@/components/clientes/perfil-cliente-analysis";

const vendas = [
  { id: "a", created_at: "2026-10-03T12:00:00-03:00", total: 100, status: "paga" },
  { id: "b", created_at: "2026-10-20T12:00:00-03:00", total: 50, status: "pendente" },
  { id: "c", created_at: "2026-10-21T12:00:00-03:00", total: 999, status: "cancelada" },
  { id: "d", created_at: "2026-11-01T02:00:00Z", total: 30, status: "paga" }, // 31/10 em Brasília
];
const itens = [
  { venda_id: "a", quantidade: 50, subtotal: 100, sabor: "Melancia" },
  { venda_id: "b", quantidade: 25, subtotal: 50, sabor: "Maracujá" },
  { venda_id: "c", quantidade: 500, subtotal: 999, sabor: "Uva" },
  { venda_id: "d", quantidade: 15, subtotal: 30, sabor: "Melancia" },
];

describe("perfil do cliente", () => {
  it("ignora canceladas e agrupa por mês no fuso de Brasília", () => {
    const pts = agruparVendas(vendasValidas(vendas), itens, "mes");
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ valor: 180, unidades: 90, comandas: 3 });
  });
  it("separa quinzenas (1-15 e 16-fim)", () => {
    const pts = agruparVendas(vendasValidas(vendas), itens, "quinzena");
    expect(pts.map((p) => p.valor)).toEqual([100, 80]);
  });
  it("top sabores por unidades sem contar canceladas", () => {
    const top = topSabores(vendasValidas(vendas), itens);
    expect(top[0]).toMatchObject({ sabor: "Melancia", unidades: 65 });
    expect(top.find((t) => t.sabor === "Uva")).toBeUndefined();
  });
});

import { resumoBebidas } from "@/components/clientes/perfil-cliente-analysis";
describe("resumoBebidas", () => {
  it("converte fardo em unidades (padrão 6) e ignora vendas fora do filtro", () => {
    const vendas = [{ id: "a", created_at: "2026-10-01T15:00:00Z", total: 100, status: "paga" }];
    const r = resumoBebidas(vendas, [
      { venda_id: "a", nome: "Brisa", quantidade: 2, subtotal: 90, tipo_venda: "unidade", unidades_fardo: 6 },
      { venda_id: "a", nome: "Brisa", quantidade: 2, subtotal: 500, tipo_venda: "fardo", unidades_fardo: null },
      { venda_id: "x", nome: "Brisa", quantidade: 9, subtotal: 9, tipo_venda: "unidade", unidades_fardo: 6 },
    ]);
    expect(r).toEqual([{ nome: "Brisa", unidades: 14, valor: 590 }]);
  });
});

import { calcularEconomia, intervaloMedioDias } from "@/components/clientes/perfil-cliente-analysis";
describe("calcularEconomia", () => {
  const vendas = [{ id: "a", created_at: "2026-10-01T15:00:00Z", total: 0, status: "paga" }];
  it("600 un a R$ 1,40 com referência R$ 1,99 economiza R$ 354,00", () => {
    expect(calcularEconomia(vendas, [{ venda_id: "a", quantidade: 600, preco_unitario: 1.4 }], 1.99)).toBe(354);
  });
  it("ignora brindes e preços iguais ou acima da referência", () => {
    expect(calcularEconomia(vendas, [
      { venda_id: "a", quantidade: 10, preco_unitario: 0 },
      { venda_id: "a", quantidade: 10, preco_unitario: 1.99 },
      { venda_id: "a", quantidade: 10, preco_unitario: 2.05 },
    ], 1.99)).toBe(0);
  });
});
describe("intervaloMedioDias", () => {
  it("compras em 01, 08 e 15 têm intervalo médio de 7 dias", () => {
    const v = ["2026-10-01", "2026-10-08", "2026-10-15"].map((d, i) => ({ id: String(i), created_at: `${d}T15:00:00Z`, total: 1, status: "paga" }));
    expect(intervaloMedioDias(v)).toBe(7);
  });
});
