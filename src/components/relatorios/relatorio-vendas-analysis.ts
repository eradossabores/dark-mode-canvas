export interface VendaRelatorioBase {
  id: string;
  total: number | string | null;
  valor_frete?: number | string | null;
}

export interface GeloSaborizadoRelatorioItem {
  venda_id: string;
  quantidade: number | null;
  subtotal: number | null;
}

export interface BebidaRelatorioItem {
  venda_id: string;
  quantidade: number | null;
  subtotal: number | null;
  tipo_venda: string | null;
  bebidas?: { unidades_fardo: number | null } | null;
}

export interface GeloCuboRelatorioItem {
  venda_id: string;
  quantidade: number | null;
  subtotal: number | null;
}

export interface ComposicaoVenda {
  gelosSaborizados: number;
  valorGelosSaborizados: number;
  precoMedioGelosSaborizados: number;
  bebidasVolumes: number;
  bebidasUnidadesReais: number;
  valorBebidas: number;
  geloCuboPacotes: number;
  valorGeloCubo: number;
  subtotalProdutos: number;
  frete: number;
  ajustes: number;
  totalNota: number;
}

export interface ResumoComposicaoVendas extends ComposicaoVenda {
  porVenda: Map<string, ComposicaoVenda>;
}

const numero = (valor: number | string | null | undefined) => Number(valor ?? 0);
const moeda = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

export function analisarComposicaoVendas(
  vendas: VendaRelatorioBase[],
  gelos: GeloSaborizadoRelatorioItem[],
  bebidas: BebidaRelatorioItem[],
  cubos: GeloCuboRelatorioItem[],
): ResumoComposicaoVendas {
  const porVenda = new Map<string, ComposicaoVenda>();

  vendas.forEach((venda) => {
    porVenda.set(venda.id, {
      gelosSaborizados: 0,
      valorGelosSaborizados: 0,
      precoMedioGelosSaborizados: 0,
      bebidasVolumes: 0,
      bebidasUnidadesReais: 0,
      valorBebidas: 0,
      geloCuboPacotes: 0,
      valorGeloCubo: 0,
      subtotalProdutos: 0,
      frete: numero(venda.valor_frete),
      ajustes: 0,
      totalNota: numero(venda.total),
    });
  });

  gelos.forEach((item) => {
    const composicao = porVenda.get(item.venda_id);
    if (!composicao) return;
    composicao.gelosSaborizados += numero(item.quantidade);
    composicao.valorGelosSaborizados += numero(item.subtotal);
  });

  bebidas.forEach((item) => {
    const composicao = porVenda.get(item.venda_id);
    if (!composicao) return;
    const quantidade = numero(item.quantidade);
    const unidadesPorFardo = numero(item.bebidas?.unidades_fardo) || 6;
    composicao.bebidasVolumes += quantidade;
    composicao.bebidasUnidadesReais += item.tipo_venda === "fardo" ? quantidade * unidadesPorFardo : quantidade;
    composicao.valorBebidas += numero(item.subtotal);
  });

  cubos.forEach((item) => {
    const composicao = porVenda.get(item.venda_id);
    if (!composicao) return;
    composicao.geloCuboPacotes += numero(item.quantidade);
    composicao.valorGeloCubo += numero(item.subtotal);
  });

  porVenda.forEach((composicao) => {
    composicao.valorGelosSaborizados = moeda(composicao.valorGelosSaborizados);
    composicao.valorBebidas = moeda(composicao.valorBebidas);
    composicao.valorGeloCubo = moeda(composicao.valorGeloCubo);
    composicao.subtotalProdutos = moeda(
      composicao.valorGelosSaborizados + composicao.valorBebidas + composicao.valorGeloCubo,
    );
    composicao.precoMedioGelosSaborizados = composicao.gelosSaborizados > 0
      ? moeda(composicao.valorGelosSaborizados / composicao.gelosSaborizados)
      : 0;
    composicao.ajustes = moeda(composicao.totalNota - composicao.subtotalProdutos - composicao.frete);
  });

  const totais = [...porVenda.values()].reduce<Omit<ResumoComposicaoVendas, "porVenda">>((total, item) => ({
    gelosSaborizados: total.gelosSaborizados + item.gelosSaborizados,
    valorGelosSaborizados: moeda(total.valorGelosSaborizados + item.valorGelosSaborizados),
    precoMedioGelosSaborizados: 0,
    bebidasVolumes: total.bebidasVolumes + item.bebidasVolumes,
    bebidasUnidadesReais: total.bebidasUnidadesReais + item.bebidasUnidadesReais,
    valorBebidas: moeda(total.valorBebidas + item.valorBebidas),
    geloCuboPacotes: total.geloCuboPacotes + item.geloCuboPacotes,
    valorGeloCubo: moeda(total.valorGeloCubo + item.valorGeloCubo),
    subtotalProdutos: moeda(total.subtotalProdutos + item.subtotalProdutos),
    frete: moeda(total.frete + item.frete),
    ajustes: moeda(total.ajustes + item.ajustes),
    totalNota: moeda(total.totalNota + item.totalNota),
  }), {
    gelosSaborizados: 0,
    valorGelosSaborizados: 0,
    precoMedioGelosSaborizados: 0,
    bebidasVolumes: 0,
    bebidasUnidadesReais: 0,
    valorBebidas: 0,
    geloCuboPacotes: 0,
    valorGeloCubo: 0,
    subtotalProdutos: 0,
    frete: 0,
    ajustes: 0,
    totalNota: 0,
  });

  totais.precoMedioGelosSaborizados = totais.gelosSaborizados > 0
    ? moeda(totais.valorGelosSaborizados / totais.gelosSaborizados)
    : 0;

  return { ...totais, porVenda };
}