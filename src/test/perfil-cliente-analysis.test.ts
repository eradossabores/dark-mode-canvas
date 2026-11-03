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
