/**
 * Cálculos puros do Perfil do Cliente (sem banco/renderização) — testáveis.
 * Datas sempre interpretadas no fuso de Brasília (UTC-3).
 */
export type Agrupamento = "semana" | "quinzena" | "mes";

export interface VendaPerfilRaw {
  id: string;
  created_at: string;
  total: number | null;
  status: string | null;
}

export interface ItemPerfilRaw {
  venda_id: string;
  quantidade: number | null;
  subtotal: number | null;
  sabor: string | null;
}

export interface PontoGrafico {
  chave: string;
  rotulo: string;
  valor: number;
  unidades: number;
  comandas: number;
}

export interface SaborRanking {
  sabor: string;
  unidades: number;
  valor: number;
  percentual: number;
}

const OFFSET_MS = 3 * 60 * 60 * 1000;
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Data no fuso de Brasília como YYYY-MM-DD. */
export function dataBR(iso: string): string {
  return new Date(new Date(iso).getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

function bucket(dia: string, ag: Agrupamento): { chave: string; rotulo: string } {
  const [y, m, d] = dia.split("-").map(Number);
  if (ag === "mes") return { chave: `${y}-${String(m).padStart(2, "0")}`, rotulo: `${MESES[m - 1]}/${String(y).slice(2)}` };
  if (ag === "quinzena") {
    const q = d <= 15 ? 1 : 2;
    return { chave: `${y}-${String(m).padStart(2, "0")}-Q${q}`, rotulo: `${q}ª ${MESES[m - 1]}/${String(y).slice(2)}` };
  }
  // semana: segunda-feira como início
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  const ini = dt.toISOString().slice(0, 10);
  return { chave: ini, rotulo: `${ini.slice(8, 10)}/${ini.slice(5, 7)}` };
}

export function vendasValidas(vendas: VendaPerfilRaw[], inicio?: string, fim?: string): VendaPerfilRaw[] {
  return vendas.filter((v) => {
    if (v.status === "cancelada") return false;
    const d = dataBR(v.created_at);
    if (inicio && d < inicio) return false;
    if (fim && d > fim) return false;
    return true;
  });
}

export function agruparVendas(vendas: VendaPerfilRaw[], itens: ItemPerfilRaw[], ag: Agrupamento): PontoGrafico[] {
  const unidadesPorVenda = new Map<string, number>();
  for (const i of itens) unidadesPorVenda.set(i.venda_id, (unidadesPorVenda.get(i.venda_id) ?? 0) + Number(i.quantidade ?? 0));
  const mapa = new Map<string, PontoGrafico>();
  for (const v of vendas) {
    const { chave, rotulo } = bucket(dataBR(v.created_at), ag);
    const p = mapa.get(chave) ?? { chave, rotulo, valor: 0, unidades: 0, comandas: 0 };
    p.valor += Number(v.total ?? 0);
    p.unidades += unidadesPorVenda.get(v.id) ?? 0;
    p.comandas += 1;
    mapa.set(chave, p);
  }
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

export function topSabores(vendas: VendaPerfilRaw[], itens: ItemPerfilRaw[], limite = 5): SaborRanking[] {
  const ids = new Set(vendas.map((v) => v.id));
  const mapa = new Map<string, { unidades: number; valor: number }>();
  let total = 0;
  for (const i of itens) {
    if (!ids.has(i.venda_id)) continue;
    const nome = i.sabor || "Sem sabor";
    const q = Number(i.quantidade ?? 0);
    const r = mapa.get(nome) ?? { unidades: 0, valor: 0 };
    r.unidades += q;
    r.valor += Number(i.subtotal ?? 0);
    mapa.set(nome, r);
    total += q;
  }
  return [...mapa.entries()]
    .map(([sabor, r]) => ({ sabor, ...r, percentual: total > 0 ? (r.unidades / total) * 100 : 0 }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, limite);
}

export interface BebidaPerfilRaw {
  venda_id: string;
  nome: string | null;
  quantidade: number | null;
  subtotal: number | null;
  tipo_venda: string | null;
  unidades_fardo: number | null;
}

export interface BebidaRanking {
  nome: string;
  unidades: number;
  valor: number;
}

/** Unidades reais de uma linha de bebida: fardo = quantidade × unidades_fardo (padrão 6). */
export function unidadesBebida(b: BebidaPerfilRaw): number {
  const q = Number(b.quantidade ?? 0);
  if (b.tipo_venda !== "fardo") return q;
  const t = Number(b.unidades_fardo ?? 6);
  return q * (t > 0 ? t : 6);
}

/** Ranking de bebidas das vendas válidas, com unidades reais e valor. */
export function resumoBebidas(vendas: VendaPerfilRaw[], bebidas: BebidaPerfilRaw[]): BebidaRanking[] {
  const ids = new Set(vendas.map((v) => v.id));
  const mapa = new Map<string, BebidaRanking>();
  for (const b of bebidas) {
    if (!ids.has(b.venda_id)) continue;
    const nome = b.nome || "Bebida";
    const r = mapa.get(nome) ?? { nome, unidades: 0, valor: 0 };
    r.unidades += unidadesBebida(b);
    r.valor += Number(b.subtotal ?? 0);
    mapa.set(nome, r);
  }
  return [...mapa.values()].sort((a, b) => b.unidades - a.unidades);
}
