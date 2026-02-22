import * as XLSX from "xlsx";

/* ───────── Types ───────── */
export interface ImportRow {
  rowNum: number;
  data: string;
  sabor: string;
  quantidade: number;
  valor?: number;
  valorTotal?: number;
  statusPagamento?: string;
  responsavel?: string;
  cliente?: string;
  errors: string[];
  warnings: string[];
  saborId?: string;
  clienteId?: string;
}

export type TipoImportacao = "producao" | "vendas";
export type LayoutType = "matrix" | "tabular";

export interface AnaliseResumo {
  totalRegistros: number;
  totalValidos: number;
  totalErros: number;
  totalQuantidade: number;
  totalValor: number;
  porProduto: { sabor: string; quantidade: number; valor: number }[];
  porStatus: { status: string; quantidade: number; valor: number; count: number }[];
  pendentes: ImportRow[];
  atrasados: ImportRow[];
}

/* ───────── Constants ───────── */
const SALES_INDICATORS = [
  "valor", "preco", "total", "preço", "unitario", "unitário",
  "cliente", "faturamento", "pagamento", "status", "pago", "fiado",
];
const PRODUCTION_INDICATORS = ["responsavel", "responsável", "operador", "lote"];

const STATUS_MAP: Record<string, string> = {
  pago: "Pago", paga: "Pago", sim: "Pago", ok: "Pago", "1": "Pago",
  pendente: "Pendente", nao: "Pendente", não: "Pendente", "0": "Pendente",
  fiado: "Fiado", fiar: "Fiado",
  atrasado: "Atrasado", atraso: "Atrasado",
  parcial: "Parcial", parcialmente: "Parcial",
};

/* ───────── Helpers ───────── */
export function normalizeText(h: string): string {
  return h.toString().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalized = headers.map(h => h ? normalizeText(String(h)) : "");
  const names = possibleNames.map(normalizeText);
  // Exact
  for (const name of names) {
    const idx = normalized.indexOf(name);
    if (idx !== -1) return idx;
  }
  // Starts with
  for (const name of names) {
    const idx = normalized.findIndex(h => h.startsWith(name));
    if (idx !== -1) return idx;
  }
  // Contains
  for (const name of names) {
    const idx = normalized.findIndex(h => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const str = String(val).trim();
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return str;
  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m3) return `20${m3[3]}-${m3[2].padStart(2, "0")}-${m3[1].padStart(2, "0")}`;
  return null;
}

export function parseNumericValue(val: any): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  let cleaned = String(val).replace(/\s/g, "").replace(/[R$]/g, "");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot === -1 && lastComma === -1) return parseFloat(cleaned) || null;
  if (lastDot > lastComma) cleaned = cleaned.replace(/,/g, "");
  else if (lastComma > lastDot) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function parseQuantity(val: any): number | null {
  const n = parseNumericValue(val);
  return n != null ? Math.round(n) : null;
}

function normalizeStatus(val: any): string {
  if (!val || String(val).trim() === "") return "Pendente";
  const key = normalizeText(String(val));
  return STATUS_MAP[key] || String(val).trim();
}

/* ───────── Layout Detection ───────── */
export function detectLayout(raw: any[][]): LayoutType {
  if (raw.length < 2 || raw[0].length < 2) return "tabular";
  const headerRow = raw[0];
  let dateCount = 0;
  for (let c = 1; c < headerRow.length; c++) {
    if (parseDate(headerRow[c]) !== null) dateCount++;
  }
  if (dateCount > 0 && dateCount >= (headerRow.length - 1) * 0.5) return "matrix";
  return "tabular";
}

export function detectTipo(headers: string[]): { tipo: TipoImportacao | null; confidence: "high" | "medium" | "low" } {
  const normalized = headers.map(h => h.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  let salesScore = 0;
  let prodScore = 0;
  for (const h of normalized) {
    if (SALES_INDICATORS.some(s => h.includes(s))) salesScore++;
    if (PRODUCTION_INDICATORS.some(s => h.includes(s))) prodScore++;
  }
  if (normalized.some(h => h === "cliente")) salesScore += 3;
  if (salesScore >= 2) return { tipo: "vendas", confidence: "high" };
  if (salesScore === 1) return { tipo: "vendas", confidence: "medium" };
  if (prodScore > 0 && salesScore === 0) return { tipo: "producao", confidence: prodScore >= 2 ? "high" : "medium" };
  return { tipo: "producao", confidence: "medium" };
}

export function unpivotMatrix(raw: any[][]): { headers: string[]; dataRows: any[][] } {
  const dateHeaders = raw[0].slice(1);
  const rows: any[][] = [];
  for (let r = 1; r < raw.length; r++) {
    const sabor = String(raw[r][0] || "").trim();
    if (!sabor) continue;
    for (let c = 1; c < raw[r].length; c++) {
      const qty = raw[r][c];
      if (qty == null || qty === "" || qty === 0) continue;
      rows.push([dateHeaders[c - 1], sabor, qty]);
    }
  }
  return { headers: ["data", "sabor", "quantidade"], dataRows: rows };
}

/* ───────── Row Parsing ───────── */
export function parseRows(
  tipo: TipoImportacao,
  headers: string[],
  dataRows: any[][],
  sabores: { id: string; nome: string }[],
  clientes: { id: string; nome: string }[],
): ImportRow[] {
  const normalizedHeaders = headers.map(h => normalizeText(h));

  // Flexible column detection
  const dataCol = findColumnIndex(headers, ["data", "date", "dia"]);
  const saborCol = findColumnIndex(headers, ["sabor", "produto", "item", "flavor"]);
  const qtdCol = findColumnIndex(headers, ["quantidade", "qtd", "qty", "quantity"]);
  const clienteCol = findColumnIndex(headers, ["cliente", "client", "comprador"]);
  const valorCol = findColumnIndex(headers, ["valor", "preco", "preço", "valor unitario", "preco unitario", "unit"]);
  const totalCol = findColumnIndex(headers, ["total", "valor total", "subtotal"]);
  const statusCol = findColumnIndex(headers, ["status", "pagamento", "status pagamento", "pago"]);
  const respCol = findColumnIndex(headers, ["responsavel", "responsável", "operador"]);

  if (dataCol === -1 || saborCol === -1 || qtdCol === -1) return [];

  const saborMap = new Map<string, string>();
  sabores.forEach(s => saborMap.set(s.nome.toLowerCase().trim(), s.id));
  const clienteMap = new Map<string, string>();
  clientes.forEach(c => clienteMap.set(c.nome.toLowerCase().trim(), c.id));

  const seen = new Set<string>();
  const parsed: ImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    if (row.every((c: any) => c === "" || c == null)) continue;

    const errors: string[] = [];
    const warnings: string[] = [];

    const dateVal = parseDate(row[dataCol]);
    if (!dateVal) errors.push("Data inválida");

    const saborRaw = String(row[saborCol] || "").trim();
    const saborId = saborMap.get(saborRaw.toLowerCase());
    if (!saborRaw) errors.push("Sabor vazio");
    else if (!saborId) errors.push(`Sabor "${saborRaw}" não encontrado`);

    const qtd = parseQuantity(row[qtdCol]);
    if (qtd == null) errors.push("Quantidade inválida");
    else if (qtd <= 0) errors.push("Quantidade deve ser positiva");

    let clienteId: string | undefined;
    let clienteRaw = "";
    if (tipo === "vendas" && clienteCol !== -1) {
      clienteRaw = String(row[clienteCol] || "").trim();
      clienteId = clienteMap.get(clienteRaw.toLowerCase());
      if (!clienteRaw) errors.push("Cliente vazio");
      else if (!clienteId) errors.push(`Cliente "${clienteRaw}" não encontrado`);
    }

    const valor = valorCol !== -1 ? parseNumericValue(row[valorCol]) : undefined;
    let valorTotal = totalCol !== -1 ? parseNumericValue(row[totalCol]) : undefined;
    if (!valorTotal && valor && qtd) valorTotal = valor * qtd;

    const statusPag = statusCol !== -1 ? normalizeStatus(row[statusCol]) : undefined;
    const respRaw = respCol !== -1 ? String(row[respCol] || "").trim() : "";

    const dupeKey = `${dateVal}|${saborRaw.toLowerCase()}|${clienteRaw.toLowerCase()}`;
    if (seen.has(dupeKey)) warnings.push("Possível duplicidade");
    seen.add(dupeKey);

    parsed.push({
      rowNum: r + 1,
      data: dateVal || String(row[dataCol]),
      sabor: saborRaw,
      quantidade: qtd ?? 0,
      valor: valor ?? undefined,
      valorTotal: valorTotal ?? undefined,
      statusPagamento: statusPag,
      responsavel: respRaw || undefined,
      cliente: clienteRaw || undefined,
      errors, warnings, saborId, clienteId,
    });
  }

  return parsed;
}

/* ───────── Analysis ───────── */
export function buildAnalise(rows: ImportRow[]): AnaliseResumo {
  const valid = rows.filter(r => r.errors.length === 0);
  const errorCount = rows.filter(r => r.errors.length > 0).length;

  const totalQuantidade = valid.reduce((s, r) => s + r.quantidade, 0);
  const totalValor = valid.reduce((s, r) => s + (r.valorTotal || 0), 0);

  // Por produto
  const prodMap = new Map<string, { quantidade: number; valor: number }>();
  for (const r of valid) {
    const key = r.sabor;
    const prev = prodMap.get(key) || { quantidade: 0, valor: 0 };
    prodMap.set(key, { quantidade: prev.quantidade + r.quantidade, valor: prev.valor + (r.valorTotal || 0) });
  }
  const porProduto = Array.from(prodMap.entries())
    .map(([sabor, v]) => ({ sabor, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Por status
  const statusMap = new Map<string, { quantidade: number; valor: number; count: number }>();
  for (const r of valid) {
    const key = r.statusPagamento || "Não informado";
    const prev = statusMap.get(key) || { quantidade: 0, valor: 0, count: 0 };
    statusMap.set(key, { quantidade: prev.quantidade + r.quantidade, valor: prev.valor + (r.valorTotal || 0), count: prev.count + 1 });
  }
  const porStatus = Array.from(statusMap.entries())
    .map(([status, v]) => ({ status, ...v }))
    .sort((a, b) => b.count - a.count);

  const pendentes = valid.filter(r => r.statusPagamento === "Pendente" || r.statusPagamento === "Fiado");
  const atrasados = valid.filter(r => r.statusPagamento === "Atrasado");

  return {
    totalRegistros: rows.length,
    totalValidos: valid.length,
    totalErros: errorCount,
    totalQuantidade,
    totalValor,
    porProduto,
    porStatus,
    pendentes,
    atrasados,
  };
}
