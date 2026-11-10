import { describe, expect, it } from "vitest";
import { bebidasPorVenda, montarTabelaFinanceira, type ComandaFinanceira } from "@/components/relatorios/financeiro-cliente-pdf";

const base = (o: Partial<ComandaFinanceira>): ComandaFinanceira => ({
  numero: "#1", data: "05/11/2026", vencimento: "—", gelos: 0, bebidas: { unidades: 0, fardos: 0 },
  valorOriginal: 0, desconto: 0, pago: 0, saldo: 0, ...o,
});

describe("relatório financeiro do cliente (PDF)", () => {
  it("converte fardos de bebida em unidades reais (4 fardos de 6 = 24 un)", () => {
    const r = bebidasPorVenda([
      { venda_id: "v381", nome: "Busca Brisa (Fardo)", quantidade: 4, subtotal: 1000, tipo_venda: "fardo", unidades_fardo: null },
    ]);
    expect(r.v381).toEqual({ unidades: 24, fardos: 4 });
  });

  it("mostra a coluna Bebidas e o total quando há bebidas (caso BOLOTA #379 + #381)", () => {
    const t = montarTabelaFinanceira([
      base({ numero: "#379", gelos: 530, valorOriginal: 1054.7, saldo: 1054.7 }),
      base({ numero: "#381", bebidas: { unidades: 24, fardos: 4 }, valorOriginal: 1000, saldo: 1000 }),
    ], { larguraTotal: 182 });
    const cols = t.colunas.map((c) => c.header);
    expect(cols).toContain("Bebidas");
    expect(t.rows[1][cols.indexOf("Bebidas")]).toBe("24 (4 fd)");
    expect(t.totais.saldo).toBeCloseTo(2054.7, 2);
    expect(t.foot[cols.indexOf("Gelos")]).toBe("530");
    expect(t.foot[cols.indexOf("Saldo")]).toBe("R$ 2.054,70".replace(" ", "\u00a0"));
  });

  it("omite a coluna Bebidas quando o cliente só comprou gelos", () => {
    const t = montarTabelaFinanceira([base({ gelos: 100, valorOriginal: 199, saldo: 199 })], { larguraTotal: 182 });
    expect(t.colunas.map((c) => c.header)).not.toContain("Bebidas");
  });

  it("as larguras das colunas somam a largura útil da página", () => {
    const t = montarTabelaFinanceira([base({ bebidas: { unidades: 6, fardos: 1 } })], { larguraTotal: 182 });
    expect(t.colunas.reduce((s, c) => s + c.width, 0)).toBeCloseTo(182, 5);
  });
});
