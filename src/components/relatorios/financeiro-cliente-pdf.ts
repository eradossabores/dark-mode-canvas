/**
 * Pure layout/calculation helpers for the customer financial report PDF
 * ("Relatório Financeiro"). No database or rendering code lives here, so the
 * totals sent to customers can be unit-tested in isolation.
 */
import { unidadesBebida, type BebidaPerfilRaw } from "@/components/clientes/perfil-cliente-analysis";

export interface BebidasDaVenda {
  /** Real units (fardos converted with their pack size, default 6). */
  unidades: number;
  /** How many packs (fardos) were sold, for the "(4 fd)" hint. */
  fardos: number;
}

/** Group beverage lines by sale: real units + fardo count. */
export function bebidasPorVenda(linhas: BebidaPerfilRaw[]): Record<string, BebidasDaVenda> {
  const out: Record<string, BebidasDaVenda> = {};
  for (const l of linhas) {
    const acc = (out[l.venda_id] ||= { unidades: 0, fardos: 0 });
    acc.unidades += unidadesBebida(l);
    if (l.tipo_venda === "fardo") acc.fardos += Number(l.quantidade ?? 0);
  }
  return out;
}

export interface ComandaFinanceira {
  numero: string;
  data: string;
  vencimento: string;
  gelos: number;
  bebidas: BebidasDaVenda;
  valorOriginal: number;
  desconto: number;
  pago: number;
  saldo: number;
}

export type Alinhamento = "left" | "center" | "right";

export interface ColunaPdf {
  header: string;
  width: number;
  align: Alinhamento;
  bold?: boolean;
}

export interface TabelaFinanceiraPdf {
  colunas: ColunaPdf[];
  rows: string[][];
  foot: string[];
  totais: {
    gelos: number;
    bebidas: number;
    fardos: number;
    valorOriginal: number;
    desconto: number;
    pago: number;
    saldo: number;
  };
  temBebidas: boolean;
}

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (n: number) => (n || 0).toLocaleString("pt-BR");

export function formatarBebidas(b: BebidasDaVenda): string {
  if (!b.unidades) return "—";
  return b.fardos > 0 ? `${int(b.unidades)} (${int(b.fardos)} fd)` : int(b.unidades);
}

/**
 * Build the PDF table with fixed column widths that add up to the page
 * content width, so values like "R$ 1.054,70" never break across lines.
 * The "Bebidas" column only appears when at least one order has beverages.
 */
export function montarTabelaFinanceira(
  comandas: ComandaFinanceira[],
  opts: { larguraTotal: number; /** Write "Quitada" in the balance of settled orders. */ mostrarSituacao?: boolean },
): TabelaFinanceiraPdf {
  const totais = comandas.reduce(
    (t, c) => ({
      gelos: t.gelos + c.gelos,
      bebidas: t.bebidas + c.bebidas.unidades,
      fardos: t.fardos + c.bebidas.fardos,
      valorOriginal: t.valorOriginal + c.valorOriginal,
      desconto: t.desconto + c.desconto,
      pago: t.pago + c.pago,
      saldo: t.saldo + c.saldo,
    }),
    { gelos: 0, bebidas: 0, fardos: 0, valorOriginal: 0, desconto: 0, pago: 0, saldo: 0 },
  );
  const temBebidas = totais.bebidas > 0;
  const mostrarSituacao = !!opts.mostrarSituacao;

  type Def = ColunaPdf & { key: string; dinheiro?: boolean };
  const defs: Def[] = [
    { key: "numero", header: "Nº", width: 14, align: "left", bold: true },
    { key: "data", header: "Data", width: 18, align: "center" },
    { key: "venc", header: "Venc.", width: 18, align: "center" },
    { key: "gelos", header: "Gelos", width: 16, align: "center" },
    ...(temBebidas ? [{ key: "bebidas", header: "Bebidas", width: 20, align: "center" as const }] : []),
    { key: "valor", header: "Valor", width: 0, align: "right", dinheiro: true },
    { key: "desconto", header: "Desconto", width: 0, align: "right", dinheiro: true },
    { key: "pago", header: "Pago", width: 0, align: "right", dinheiro: true },
    { key: "saldo", header: "Saldo", width: 0, align: "right", dinheiro: true, bold: true },
  ];
  const fixo = defs.filter((d) => !d.dinheiro).reduce((s, d) => s + d.width, 0);
  const dinheiro = defs.filter((d) => d.dinheiro);
  const porColuna = Math.max(22, (opts.larguraTotal - fixo) / dinheiro.length);
  dinheiro.forEach((d) => (d.width = porColuna));

  const celula = (c: ComandaFinanceira, key: string): string => {
    switch (key) {
      case "numero": return c.numero;
      case "data": return c.data;
      case "venc": return c.vencimento || "—";
      case "gelos": return c.gelos ? int(c.gelos) : "—";
      case "bebidas": return formatarBebidas(c.bebidas);
      case "valor": return brl(c.valorOriginal);
      case "desconto": return c.desconto > 0 ? `- ${brl(c.desconto)}` : "—";
      case "pago": return c.pago > 0 ? `- ${brl(c.pago)}` : "—";
      // Settled orders read "Quitada" instead of a bare R$ 0,00.
      case "saldo": return mostrarSituacao && c.saldo <= 0 ? "Quitada" : brl(c.saldo);
      default: return "";
    }
  };
  const rodape = (key: string): string => {
    switch (key) {
      case "numero": return "TOTAL";
      case "gelos": return int(totais.gelos);
      case "bebidas": return formatarBebidas({ unidades: totais.bebidas, fardos: totais.fardos });
      case "valor": return brl(totais.valorOriginal);
      case "desconto": return totais.desconto > 0 ? `- ${brl(totais.desconto)}` : "—";
      case "pago": return totais.pago > 0 ? `- ${brl(totais.pago)}` : "—";
      case "saldo": return brl(totais.saldo);
      default: return "";
    }
  };

  return {
    colunas: defs.map(({ header, width, align, bold }) => ({ header, width, align, bold })),
    rows: comandas.map((c) => defs.map((d) => celula(c, d.key))),
    foot: defs.map((d) => rodape(d.key)),
    totais,
    temBebidas,
  };
}
