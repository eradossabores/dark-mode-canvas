export type RecorrenciaStatus = "regular" | "em_breve" | "atrasado" | "novo";

export interface CompraRecorrencia {
  id: string;
  data: Date;
  numeroPedido: number | null;
  valor: number;
  unidades: number;
  intervaloAnterior: number | null;
  produtos: { nome: string; quantidade: number }[];
}

export interface ClienteRecorrencia {
  id: string;
  nome: string;
  compras: CompraRecorrencia[];
  totalCompras: number;
  totalUnidades: number;
  mediaUnidades: number;
  totalGasto: number;
  ticketMedio: number;
  frequenciaMedia: number;
  diasDesdeUltima: number;
  ultimaCompra: Date;
  proximaCompra: Date | null;
  diasParaProxima: number | null;
  diasAtraso: number;
  status: RecorrenciaStatus;
  produtosFavoritos: { nome: string; quantidade: number }[];
}

export const statusLabels: Record<RecorrenciaStatus, string> = {
  regular: "Regular",
  em_breve: "Comprar em breve",
  atrasado: "Atrasado",
  novo: "Novo",
};

export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}