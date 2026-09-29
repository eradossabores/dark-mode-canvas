export const PRECO_REFERENCIA_GELO = 1.99;

export interface ItemMensalRaw {
  id: string;
  venda_id: string;
  quantidade: number | null;
  preco_unitario: number | null;
  subtotal: number | null;
  sabores: { nome: string } | null;
  vendas: {
    id: string;
    numero_pedido: number | null;
    created_at: string;
  } | null;
}

export interface ItemMensalDetalhado {
  id: string;
  vendaId: string;
  numeroPedido: number | null;
  data: string;
  sabor: string;
  quantidade: number;
  precoUnitario: number;
  valorPago: number;
  economia: number;
  brinde: boolean;
}

export interface SaborMensal {
  nome: string;
  quantidade: number;
  participacao: number;
  precoMedio: number;
  valorPago: number;
  economia: number;
  brindes: number;
}

export interface EntregaMensal {
  vendaId: string;
  numeroPedido: number | null;
  data: string;
  quantidade: number;
  valorPago: number;
}

export interface ResumoMensalCliente {
  itens: ItemMensalDetalhado[];
  ranking: SaborMensal[];
  entregas: EntregaMensal[];
  totalUnidades: number;
  totalPedidos: number;
  totalEntregas: number;
  totalPago: number;
  totalEconomia: number;
  totalBrindes: number;
  precoMedio: number;
}

const moeda = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

export function analisarComprasMensais(itensRaw: ItemMensalRaw[]): ResumoMensalCliente {
  const itens = itensRaw.flatMap<ItemMensalDetalhado>((item) => {
    const quantidade = Number(item.quantidade ?? 0);
    const venda = item.vendas;
    if (!venda || quantidade <= 0) return [];

    const precoUnitario = Number(item.preco_unitario ?? 0);
    const brinde = precoUnitario <= 0;
    const valorPago = Number(item.subtotal ?? quantidade * precoUnitario);
    const economia = brinde ? 0 : quantidade * Math.max(0, PRECO_REFERENCIA_GELO - precoUnitario);

    return [{
      id: item.id,
      vendaId: item.venda_id,
      numeroPedido: venda.numero_pedido,
      data: venda.created_at,
      sabor: item.sabores?.nome ?? "Sabor não identificado",
      quantidade,
      precoUnitario,
      valorPago: moeda(valorPago),
      economia: moeda(economia),
      brinde,
    }];
  });

  const totalUnidades = itens.reduce((total, item) => total + item.quantidade, 0);
  const totalPago = itens.reduce((total, item) => total + item.valorPago, 0);
  const totalEconomia = itens.reduce((total, item) => total + item.economia, 0);
  const totalBrindes = itens.filter((item) => item.brinde).reduce((total, item) => total + item.quantidade, 0);
  const unidadesPagas = totalUnidades - totalBrindes;
  const sabores = new Map<string, Omit<SaborMensal, "participacao" | "precoMedio"> & { unidadesPagas: number }>();

  itens.forEach((item) => {
    const atual = sabores.get(item.sabor) ?? {
      nome: item.sabor,
      quantidade: 0,
      valorPago: 0,
      economia: 0,
      brindes: 0,
      unidadesPagas: 0,
    };
    atual.quantidade += item.quantidade;
    atual.valorPago += item.valorPago;
    atual.economia += item.economia;
    atual.brindes += item.brinde ? item.quantidade : 0;
    atual.unidadesPagas += item.brinde ? 0 : item.quantidade;
    sabores.set(item.sabor, atual);
  });

  const ranking = [...sabores.values()]
    .map((sabor) => ({
      nome: sabor.nome,
      quantidade: sabor.quantidade,
      participacao: totalUnidades > 0 ? (sabor.quantidade / totalUnidades) * 100 : 0,
      precoMedio: sabor.unidadesPagas > 0 ? sabor.valorPago / sabor.unidadesPagas : 0,
      valorPago: moeda(sabor.valorPago),
      economia: moeda(sabor.economia),
      brindes: sabor.brindes,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));

  const entregasPorVenda = new Map<string, EntregaMensal>();
  itens.forEach((item) => {
    const atual = entregasPorVenda.get(item.vendaId) ?? {
      vendaId: item.vendaId,
      numeroPedido: item.numeroPedido,
      data: item.data,
      quantidade: 0,
      valorPago: 0,
    };
    atual.quantidade += item.quantidade;
    atual.valorPago = moeda(atual.valorPago + item.valorPago);
    entregasPorVenda.set(item.vendaId, atual);
  });
  const entregas = [...entregasPorVenda.values()]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return {
    itens: itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    ranking,
    entregas,
    totalUnidades,
    totalPedidos: entregas.length,
    totalEntregas: entregas.length,
    totalPago: moeda(totalPago),
    totalEconomia: moeda(totalEconomia),
    totalBrindes,
    precoMedio: unidadesPagas > 0 ? totalPago / unidadesPagas : 0,
  };
}