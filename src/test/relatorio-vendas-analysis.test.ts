import { describe, expect, it } from "vitest";
import { analisarComposicaoVendas } from "@/components/relatorios/relatorio-vendas-analysis";

describe("analisarComposicaoVendas", () => {
  it("separa gelos, bebidas em fardo, cubos, frete e total da nota", () => {
    const resultado = analisarComposicaoVendas(
      [
        { id: "v1", total: 219, valor_frete: 10 },
        { id: "v2", total: 590, valor_frete: 0 },
      ],
      [{ venda_id: "v1", quantidade: 100, subtotal: 199 }],
      [{ venda_id: "v2", quantidade: 2, subtotal: 590, tipo_venda: "fardo", bebidas: { unidades_fardo: 6 } }],
      [{ venda_id: "v1", quantidade: 1, subtotal: 10 }],
    );

    expect(resultado.gelosSaborizados).toBe(100);
    expect(resultado.precoMedioGelosSaborizados).toBe(1.99);
    expect(resultado.bebidasVolumes).toBe(2);
    expect(resultado.bebidasUnidadesReais).toBe(12);
    expect(resultado.geloCuboPacotes).toBe(1);
    expect(resultado.subtotalProdutos).toBe(799);
    expect(resultado.frete).toBe(10);
    expect(resultado.totalNota).toBe(809);
    expect(resultado.ajustes).toBe(0);
  });

  it("expõe diferença entre produtos, frete e total como ajuste", () => {
    const resultado = analisarComposicaoVendas(
      [{ id: "v1", total: 190, valor_frete: 0 }],
      [{ venda_id: "v1", quantidade: 100, subtotal: 199 }],
      [],
      [],
    );

    expect(resultado.ajustes).toBe(-9);
    expect(resultado.porVenda.get("v1")?.ajustes).toBe(-9);
  });
});