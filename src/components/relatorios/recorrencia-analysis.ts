import { addDays, differenceInCalendarDays } from "date-fns";
import { ClienteRecorrencia, CompraRecorrencia, RecorrenciaStatus } from "./recorrencia-types";

interface ClienteRaw {
  id: string;
  nome: string;
}

interface ItemRaw {
  quantidade: number | null;
  sabores?: { nome: string } | null;
}

interface BebidaItemRaw {
  nome: string;
  quantidade: number | null;
  tipo_venda: string | null;
  bebidas?: { unidades_fardo: number | null } | null;
}

interface CuboItemRaw {
  quantidade: number | null;
  tamanho: string | null;
}

export interface VendaRecorrenciaRaw {
  id: string;
  cliente_id: string;
  created_at: string;
  numero_pedido: number | null;
  total: number | null;
  venda_itens?: ItemRaw[] | null;
  venda_bebida_itens?: BebidaItemRaw[] | null;
  venda_gelo_cubo_itens?: CuboItemRaw[] | null;
}

function itensDaVenda(venda: VendaRecorrenciaRaw): { nome: string; quantidade: number }[] {
  const gelos = (venda.venda_itens ?? []).map((item) => ({
    nome: item.sabores?.nome ?? "Gelo saborizado",
    quantidade: Number(item.quantidade ?? 0),
  }));
  const bebidas = (venda.venda_bebida_itens ?? []).map((item) => {
    const fardo = item.tipo_venda === "fardo";
    const unidades = fardo ? Number(item.bebidas?.unidades_fardo ?? 1) : 1;
    return {
      nome: `${item.nome}${fardo && !/\(fardo\)/i.test(item.nome) ? " (Fardo)" : ""}`,
      quantidade: Number(item.quantidade ?? 0) * unidades,
    };
  });
  const cubos = (venda.venda_gelo_cubo_itens ?? []).map((item) => ({
    nome: `Gelo Cubo Filtrado${item.tamanho ? ` ${item.tamanho}` : ""}`,
    quantidade: Number(item.quantidade ?? 0),
  }));
  return [...gelos, ...bebidas, ...cubos].filter((item) => item.quantidade > 0);
}

function definirStatus(totalCompras: number, diasDesdeUltima: number, frequenciaMedia: number): RecorrenciaStatus {
  if (totalCompras < 2 || frequenciaMedia <= 0) return "novo";
  if (diasDesdeUltima > frequenciaMedia) return "atrasado";
  if (diasDesdeUltima >= frequenciaMedia * 0.8) return "em_breve";
  return "regular";
}

export function analisarRecorrencia(clientes: ClienteRaw[], vendas: VendaRecorrenciaRaw[], hoje = new Date()): ClienteRecorrencia[] {
  const vendasPorCliente = new Map<string, VendaRecorrenciaRaw[]>();
  vendas.forEach((venda) => {
    const atuais = vendasPorCliente.get(venda.cliente_id) ?? [];
    atuais.push(venda);
    vendasPorCliente.set(venda.cliente_id, atuais);
  });

  return clientes.flatMap((cliente) => {
    const vendasCliente = (vendasPorCliente.get(cliente.id) ?? [])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (vendasCliente.length === 0) return [];

    const produtosTotais = new Map<string, number>();
    const compras: CompraRecorrencia[] = vendasCliente.map((venda, index) => {
      const data = new Date(venda.created_at);
      const produtos = itensDaVenda(venda);
      produtos.forEach((produto) => produtosTotais.set(produto.nome, (produtosTotais.get(produto.nome) ?? 0) + produto.quantidade));
      return {
        id: venda.id,
        data,
        numeroPedido: venda.numero_pedido,
        valor: Number(venda.total ?? 0),
        unidades: produtos.reduce((total, produto) => total + produto.quantidade, 0),
        intervaloAnterior: index === 0 ? null : differenceInCalendarDays(data, new Date(vendasCliente[index - 1].created_at)),
        produtos,
      };
    });

    const intervalos = compras.flatMap((compra) => compra.intervaloAnterior === null ? [] : [compra.intervaloAnterior]);
    const frequenciaMedia = intervalos.length > 0
      ? Math.max(1, Math.round(intervalos.reduce((total, dias) => total + dias, 0) / intervalos.length))
      : 0;
    const ultimaCompra = compras[compras.length - 1].data;
    const diasDesdeUltima = Math.max(0, differenceInCalendarDays(hoje, ultimaCompra));
    const proximaCompra = frequenciaMedia > 0 ? addDays(ultimaCompra, frequenciaMedia) : null;
    const diasParaProxima = proximaCompra ? differenceInCalendarDays(proximaCompra, hoje) : null;
    const totalUnidades = compras.reduce((total, compra) => total + compra.unidades, 0);
    const totalGasto = compras.reduce((total, compra) => total + compra.valor, 0);
    const status = definirStatus(compras.length, diasDesdeUltima, frequenciaMedia);

    return [{
      id: cliente.id,
      nome: cliente.nome,
      compras,
      totalCompras: compras.length,
      totalUnidades,
      mediaUnidades: totalUnidades / compras.length,
      totalGasto,
      ticketMedio: totalGasto / compras.length,
      frequenciaMedia,
      diasDesdeUltima,
      ultimaCompra,
      proximaCompra,
      diasParaProxima,
      diasAtraso: diasParaProxima !== null ? Math.max(0, -diasParaProxima) : 0,
      status,
      produtosFavoritos: [...produtosTotais.entries()]
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5),
    }];
  }).sort((a, b) => {
    if (a.status === "atrasado" && b.status !== "atrasado") return -1;
    if (a.status !== "atrasado" && b.status === "atrasado") return 1;
    return b.totalCompras - a.totalCompras;
  });
}