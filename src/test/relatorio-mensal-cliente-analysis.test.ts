import { describe, expect, it } from "vitest";
import { analisarComprasMensais, ItemMensalRaw } from "@/components/relatorios/relatorio-mensal-cliente-analysis";

const venda = (id: string, pedido: number) => ({ id, numero_pedido: pedido, created_at: `2026-09-${String(pedido).padStart(2, "0")}T12:00:00-03:00` });
const itens: ItemMensalRaw[] = [
  { id: "1", venda_id: "v1", quantidade: 100, preco_unitario: 1.85, subtotal: 185, sabores: { nome: "Morango" }, vendas: venda("v1", 1) },
  { id: "2", venda_id: "v2", quantidade: 50, preco_unitario: 1.99, subtotal: 99.5, sabores: { nome: "Maracujá" }, vendas: venda("v2", 2) },
  { id: "3", venda_id: "v2", quantidade: 10, preco_unitario: 0, subtotal: 0, sabores: { nome: "Morango" }, vendas: venda("v2", 2) },
];

describe("analisarComprasMensais", () => {
  it("calcula economia pelo preço de referência e não inclui brindes", () => {
    const resultado = analisarComprasMensais(itens);
    expect(resultado.totalUnidades).toBe(160);
    expect(resultado.totalPedidos).toBe(2);
    expect(resultado.totalPago).toBe(284.5);
    expect(resultado.totalEconomia).toBe(14);
    expect(resultado.totalBrindes).toBe(10);
    expect(resultado.precoMedio).toBeCloseTo(284.5 / 150);
  });

  it("ordena o ranking por quantidade e calcula participação", () => {
    const resultado = analisarComprasMensais(itens);
    expect(resultado.ranking[0].nome).toBe("Morango");
    expect(resultado.ranking[0].quantidade).toBe(110);
    expect(resultado.ranking[0].economia).toBe(14);
    expect(resultado.ranking[0].participacao).toBeCloseTo(68.75);
  });

  it("não apresenta economia negativa para preços acima da referência", () => {
    const resultado = analisarComprasMensais([{ ...itens[0], preco_unitario: 2.05, subtotal: 205 }]);
    expect(resultado.totalEconomia).toBe(0);
  });
});