import * as XLSX from "xlsx";

/* ───────── Types ───────── */
export interface ImportRow {
  rowNum: number;
  data: string;
  semana?: string;
  sabor: string;
  quantidade: number;
  valor?: number;
  valorTotal?: number;
  statusPagamento?: string;
  responsavel?: string;
  cliente?: string;
  formaPagamento?: string;
  observacoes?: string;
  errors: string[];
  warnings: string[];
  saborId?: string;
  clienteId?: string;
}

export type TipoImportacao = "producao" | "vendas";
export type LayoutType = "matrix" | "tabular" | "wide";

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
  parcelado: "Parcelado", parcial: "Parcial", parcialmente: "Parcial",
  "ñ pago": "Pendente", "nao pago": "Pendente", "não pago": "Pendente",
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
    // Skip absurd serial numbers (corrupted data)
    if (val > 50000 || val < 1) return null;
    const d = XLSX.SSF.parse_date_code(val);
    if (d && d.y > 2000 && d.y < 2100) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return null;
  }
  const str = String(val).trim();

  // DD/MM/YYYY
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const a = parseInt(m1[1]), b = parseInt(m1[2]), y = parseInt(m1[3]);
    if (y < 2000 || y > 2100) return null;
    // If first > 12, it must be day (DD/MM), if second > 12 it must be day (MM/DD)
    if (a > 12 && b <= 12) return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (b > 12 && a <= 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    // Default DD/MM/YYYY
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return str;

  // D/M/YY or DD/MM/YY — also handle M/D/YY
  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m3) {
    const a = parseInt(m3[1]), b = parseInt(m3[2]), yy = parseInt(m3[3]);
    const y = yy < 50 ? 2000 + yy : 1900 + yy;
    if (a > 12 && b <= 12) return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (b > 12 && a <= 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    // Default DD/MM/YY
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }

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
  const raw = String(val).trim();
  const key = normalizeText(raw);
  // Check exact key
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  // Check raw lowercase
  const lower = raw.toLowerCase();
  if (STATUS_MAP[lower]) return STATUS_MAP[lower];
  // Contains check
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return raw;
}

/* ───────── Layout Detection ───────── */
export type MatrixOrientation = "dates-as-columns" | "dates-as-rows";

export function detectLayout(
  raw: any[][],
  sabores?: { id: string; nome: string }[]
): { layout: LayoutType; orientation?: MatrixOrientation; flavorCols?: number[] } {
  if (raw.length < 2 || raw[0].length < 2) return { layout: "tabular" };
  const headerRow = raw[0];

  // Case 1: dates as column headers (B+), flavors as row labels (A)
  let dateCountCols = 0;
  for (let c = 1; c < headerRow.length; c++) {
    if (parseDate(headerRow[c]) !== null) dateCountCols++;
  }
  if (dateCountCols > 0 && dateCountCols >= (headerRow.length - 1) * 0.5) {
    return { layout: "matrix", orientation: "dates-as-columns" };
  }

  // Case 2: dates in column A (data rows), flavors as column headers (B+)
  const firstHeaderNorm = normalizeText(String(headerRow[0] || ""));
  const isFirstColDate = ["data", "date", "dia", "datas"].includes(firstHeaderNorm);
  if (isFirstColDate) {
    let dateCountRows = 0;
    const checkRows = Math.min(raw.length - 1, 10);
    for (let r = 1; r <= checkRows; r++) {
      if (parseDate(raw[r]?.[0]) !== null) dateCountRows++;
    }
    if (dateCountRows >= checkRows * 0.5) {
      // Check if this is "wide" format (flavor names as columns, plus other metadata columns)
      if (sabores && sabores.length > 0) {
        const flavorCols = detectFlavorColumns(headerRow, sabores);
        if (flavorCols.length >= 3) {
          return { layout: "wide", flavorCols };
        }
      }
      return { layout: "matrix", orientation: "dates-as-rows" };
    }
  }

  // Case 3: Wide format — headers include SEMANA/DATA/CLIENTE + flavor names as columns
  if (sabores && sabores.length > 0) {
    const flavorCols = detectFlavorColumns(headerRow, sabores);
    if (flavorCols.length >= 3) {
      return { layout: "wide", flavorCols };
    }
  }

  return { layout: "tabular" };
}

/** Detect which header columns match known flavor/sabor names */
function detectFlavorColumns(
  headerRow: any[],
  sabores: { id: string; nome: string }[]
): number[] {
  const matched: number[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || "").trim();
    if (!h) continue;
    if (matchSabor(h, sabores)) {
      matched.push(c);
    }
  }
  return matched;
}

function matchSabor(name: string, sabores: { id: string; nome: string }[]): boolean {
  const norm = normalizeText(name);
  if (!norm || norm.length < 2) return false;

  // Skip known non-flavor column names and single-letter headers (e.g. W, X, Y)
  const trimmed = name.trim();
  if (trimmed.length <= 2 && /^[A-Za-z]{1,2}$/.test(trimmed)) return false;

  const skipNames = ["semana", "data", "cliente", "quantidade", "pagamento", "status", "total",
    "observacoes", "observações", "fpagto", "formapagamento", "outros", "totalsemanal",
    "w", "x", "y", "z", "col", "column"];
  if (skipNames.some(s => norm === normalizeText(s))) return false;

  for (const s of sabores) {
    const sNorm = normalizeText(s.nome);
    if (sNorm === norm) return true;
    if (sNorm.startsWith(norm) || norm.startsWith(sNorm)) return true;
    // Handle abbreviations: "c/" -> "com", "hort." -> "hortela"
    const expanded = name.toLowerCase().replace(/c\//g, "com ").replace(/\./g, "").replace(/\s+/g, " ").trim();
    const sLower = s.nome.toLowerCase().replace(/\s+/g, " ").trim();
    if (sLower.startsWith(expanded) || expanded.startsWith(sLower)) return true;
    // Contains
    if (sNorm.includes(norm) || norm.includes(sNorm)) return true;
  }
  return false;
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

export function unpivotMatrix(raw: any[][], orientation: MatrixOrientation): { headers: string[]; dataRows: any[][] } {
  const rows: any[][] = [];

  if (orientation === "dates-as-columns") {
    const dateHeaders = raw[0].slice(1);
    for (let r = 1; r < raw.length; r++) {
      const sabor = String(raw[r][0] || "").trim();
      if (!sabor) continue;
      for (let c = 1; c < raw[r].length; c++) {
        const qty = raw[r][c];
        if (qty == null || qty === "" || qty === 0) continue;
        rows.push([dateHeaders[c - 1], sabor, qty]);
      }
    }
  } else {
    const flavorHeaders = raw[0].slice(1);
    for (let r = 1; r < raw.length; r++) {
      const dateVal = raw[r][0];
      if (dateVal == null || String(dateVal).trim() === "") continue;
      for (let c = 1; c < raw[r].length; c++) {
        const qty = raw[r][c];
        if (qty == null || qty === "" || qty === 0) continue;
        const sabor = String(flavorHeaders[c - 1] || "").trim();
        if (!sabor) continue;
        rows.push([dateVal, sabor, qty]);
      }
    }
  }

  return { headers: ["data", "sabor", "quantidade"], dataRows: rows };
}

/**
 * Unpivot wide format: each row has date, client, and quantities in flavor columns.
 * Creates one ImportRow per flavor with qty > 0.
 */
export function unpivotWide(
  raw: any[][],
  flavorCols: number[],
  sabores: { id: string; nome: string }[]
): { headers: string[]; dataRows: any[][] } {
  const headerRow = raw[0];
  const nonFlavorCols: { idx: number; name: string }[] = [];
  const flavorSet = new Set(flavorCols);

  for (let c = 0; c < headerRow.length; c++) {
    if (!flavorSet.has(c)) {
      nonFlavorCols.push({ idx: c, name: String(headerRow[c] || "").trim() });
    }
  }

  // Output: semana, data, sabor, quantidade, cliente, pagamento, status, f_pagto, observacoes
  const outHeaders = ["semana", "data", "sabor", "quantidade", "cliente", "pagamento", "status", "f. pagto", "observações"];
  
  // Detect SEMANA column: named "semana" or unnamed column with small integers
  let semanaCol = nonFlavorCols.find(c => normalizeText(c.name) === "semana");
  if (!semanaCol) {
    for (const col of nonFlavorCols) {
      if (col.name === "" || col.name === " ") {
        let intCount = 0;
        const checkRows = Math.min(raw.length - 1, 20);
        for (let r = 1; r <= checkRows; r++) {
          const val = raw[r]?.[col.idx];
          if (val != null && val !== "" && typeof val === "number" && val > 0 && val <= 52 && Number.isInteger(val)) intCount++;
        }
        if (intCount >= 2) { semanaCol = col; break; }
      }
    }
  }

  const dataCol = nonFlavorCols.find(c => ["data", "date", "dia"].includes(normalizeText(c.name)));
  
  // Client column: look for named "cliente" OR unnamed column that has text data
  let clienteCol = nonFlavorCols.find(c => normalizeText(c.name) === "cliente");
  if (!clienteCol) {
    for (const col of nonFlavorCols) {
      if (col === semanaCol || col === dataCol) continue;
      if (col.name === "" || col.name === " ") {
        let textCount = 0;
        const checkRows = Math.min(raw.length - 1, 20);
        for (let r = 1; r <= checkRows; r++) {
          const val = String(raw[r]?.[col.idx] || "").trim();
          if (val && isNaN(Number(val)) && parseDate(val) === null) textCount++;
        }
        if (textCount >= 2) { clienteCol = col; break; }
      }
    }
  }
  
  // Also detect unnamed DATA column (has date values)
  let effectiveDataCol = dataCol;
  if (!effectiveDataCol) {
    for (const col of nonFlavorCols) {
      if (col === semanaCol || col === clienteCol) continue;
      let dateCount = 0;
      const checkRows = Math.min(raw.length - 1, 10);
      for (let r = 1; r <= checkRows; r++) {
        if (parseDate(raw[r]?.[col.idx]) !== null) dateCount++;
      }
      if (dateCount >= 2) { effectiveDataCol = col; break; }
    }
  }

  const qtdTotalCol = nonFlavorCols.find(c => normalizeText(c.name) === "quantidade");
  const pagCol = nonFlavorCols.find(c => normalizeText(c.name).includes("pagamento") && !normalizeText(c.name).includes("fpagto") && !normalizeText(c.name).includes("forma"));
  const statusCol = nonFlavorCols.find(c => normalizeText(c.name) === "status" || normalizeText(c.name) === "pago");
  const fPagtoCol = nonFlavorCols.find(c => {
    const n = normalizeText(c.name);
    return n === "fpagto" || n.includes("formapag") || n.includes("fpag");
  });
  const obsCol = nonFlavorCols.find(c => {
    const n = normalizeText(c.name);
    return n.includes("observa");
  });

  // Detect unnamed status/payment columns by content analysis
  let effectiveStatusCol = statusCol;
  let effectiveFPagtoCol = fPagtoCol;
  if (!effectiveStatusCol || !effectiveFPagtoCol) {
    const usedCols = new Set([semanaCol?.idx, effectiveDataCol?.idx, clienteCol?.idx, qtdTotalCol?.idx, pagCol?.idx, statusCol?.idx, fPagtoCol?.idx, obsCol?.idx, ...flavorCols]);
    for (const col of nonFlavorCols) {
      if (usedCols.has(col.idx)) continue;
      const checkRows = Math.min(raw.length - 1, 10);
      let statusHits = 0, pagHits = 0;
      for (let r = 1; r <= checkRows; r++) {
        const val = normalizeText(String(raw[r]?.[col.idx] || ""));
        if (["pago", "paga", "pendente", "fiado", "parcial", "atrasado"].some(s => val.includes(s))) statusHits++;
        if (["pix", "dinheiro", "cartao", "boleto", "credito", "debito", "transferencia"].some(s => val.includes(s))) pagHits++;
      }
      if (!effectiveStatusCol && statusHits >= 2) { effectiveStatusCol = col; usedCols.add(col.idx); continue; }
      if (!effectiveFPagtoCol && pagHits >= 2) { effectiveFPagtoCol = col; usedCols.add(col.idx); continue; }
    }
  }

  const rows: any[][] = [];
  let lastDate: any = null;
  let lastSemana: any = null;

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row || row.every((c: any) => c === "" || c == null || c === 0)) continue;

    // Date fill-down: inherit from previous row if empty
    let dateVal = effectiveDataCol ? row[effectiveDataCol.idx] : null;
    if (dateVal != null && dateVal !== "" && dateVal !== 0) {
      lastDate = dateVal;
    } else {
      dateVal = lastDate;
    }

    // Semana fill-down
    let semanaVal = semanaCol ? row[semanaCol.idx] : null;
    if (semanaVal != null && semanaVal !== "" && semanaVal !== 0) {
      lastSemana = semanaVal;
    } else {
      semanaVal = lastSemana;
    }

    const clienteVal = clienteCol ? String(row[clienteCol.idx] || "").trim() : "";
    const pagVal = pagCol ? row[pagCol.idx] : "";
    const statusVal = effectiveStatusCol ? String(row[effectiveStatusCol.idx] || "").trim() : "";
    const fPagtoVal = effectiveFPagtoCol ? String(row[effectiveFPagtoCol.idx] || "").trim() : "";
    const obsVal = obsCol ? String(row[obsCol.idx] || "").trim() : "";

    // Skip rows with no date and no client (likely summary rows)
    if (!dateVal && !clienteVal) continue;

    // Check if any flavor column has a value
    let hasAnyFlavor = false;
    for (const fc of flavorCols) {
      const v = parseQuantity(row[fc]);
      if (v != null && v > 0) { hasAnyFlavor = true; break; }
    }

    if (hasAnyFlavor) {
      for (const fc of flavorCols) {
        const qty = parseQuantity(row[fc]);
        if (qty == null || qty <= 0) continue;
        const flavorName = String(headerRow[fc] || "").trim();
        rows.push([semanaVal, dateVal, flavorName, qty, clienteVal, pagVal, statusVal, fPagtoVal, obsVal]);
      }
    } else {
      const totalQty = qtdTotalCol ? parseQuantity(row[qtdTotalCol.idx]) : null;
      if (totalQty && totalQty > 0) {
        rows.push([semanaVal, dateVal, "(sem detalhe sabor)", totalQty, clienteVal, pagVal, statusVal, fPagtoVal, obsVal]);
      }
    }
  }

  return { headers: outHeaders, dataRows: rows };
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
  const semanaCol = findColumnIndex(headers, ["semana", "sem", "week"]);
  const dataCol = findColumnIndex(headers, ["data", "date", "dia", "datas", "dt", "periodo", "mes"]);
  const saborCol = findColumnIndex(headers, ["sabor", "produto", "item", "flavor", "gelo", "tipo", "descricao"]);
  const qtdCol = findColumnIndex(headers, ["quantidade", "qtd", "qty", "quantity", "quant", "un", "unidade", "unidades"]);
  const clienteCol = findColumnIndex(headers, ["cliente", "client", "comprador"]);
  const valorCol = findColumnIndex(headers, ["valor unitario", "preco unitario", "preco", "preço", "unit"]);
  const totalCol = findColumnIndex(headers, ["total", "valor total", "subtotal", "valor", "pagamento"]);
  const statusCol = findColumnIndex(headers, ["status"]);
  const respCol = findColumnIndex(headers, ["responsavel", "responsável", "operador"]);
  const fPagtoCol = findColumnIndex(headers, ["f. pagto", "f pagto", "forma pagamento", "forma de pagamento", "fpagto"]);
  const obsCol = findColumnIndex(headers, ["observações", "observacoes", "obs", "notas"]);

  // If qty column not found but we have data+sabor, try first numeric column
  let effectiveQtdCol = qtdCol;
  if (effectiveQtdCol === -1 && dataCol !== -1 && saborCol !== -1) {
    for (let c = 0; c < headers.length; c++) {
      if (c === dataCol || c === saborCol) continue;
      if (dataRows.length > 0 && parseNumericValue(dataRows[0][c]) != null) {
        effectiveQtdCol = c;
        break;
      }
    }
  }

  if (dataCol === -1 || saborCol === -1 || effectiveQtdCol === -1) return [];

  const saborMap = new Map<string, string>();
  sabores.forEach(s => saborMap.set(s.nome.toLowerCase().trim(), s.id));

  function findSaborId(raw: string): string | undefined {
    const key = raw.toLowerCase().trim();
    const exact = saborMap.get(key);
    if (exact) return exact;
    const norm = normalizeText(raw);
    for (const s of sabores) {
      const sNorm = normalizeText(s.nome);
      if (sNorm === norm) return s.id;
      if (sNorm.startsWith(norm) || norm.startsWith(sNorm)) return s.id;
      const expanded = key.replace(/c\//g, "com").replace(/\./g, "").replace(/\s+/g, " ").trim();
      const sLower = s.nome.toLowerCase().trim();
      const sExpanded = sLower.replace(/ã/g, "a").replace(/á/g, "a").replace(/é/g, "e").replace(/ç/g, "c");
      const eExpanded = expanded.replace(/ã/g, "a").replace(/á/g, "a").replace(/é/g, "e").replace(/ç/g, "c");
      if (sExpanded.startsWith(eExpanded) || eExpanded.startsWith(sExpanded)) return s.id;
      if (sNorm.includes(norm) || norm.includes(sNorm)) return s.id;
    }
    return undefined;
  }

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
    const saborId = findSaborId(saborRaw);
    if (!saborRaw) errors.push("Sabor vazio");
    else if (saborRaw === "(sem detalhe sabor)") warnings.push("Sabores não detalhados");
    else if (!saborId) errors.push(`Sabor "${saborRaw}" não encontrado`);

    const qtd = parseQuantity(row[effectiveQtdCol]);
    if (qtd == null) errors.push("Quantidade inválida");
    else if (qtd <= 0) errors.push("Quantidade deve ser positiva");

    let clienteId: string | undefined;
    let clienteRaw = "";
    if (tipo === "vendas" && clienteCol !== -1) {
      clienteRaw = String(row[clienteCol] || "").trim();
      clienteId = clienteMap.get(clienteRaw.toLowerCase());
      if (!clienteRaw) warnings.push("Cliente vazio");
      else if (!clienteId) warnings.push(`Cliente "${clienteRaw}" será criado automaticamente`);
    }

    const valorRaw = valorCol !== -1 ? row[valorCol] : undefined;
    const valor = valorRaw != null && String(valorRaw).trim() !== "" && String(valorRaw).trim() !== "-"
      ? parseNumericValue(valorRaw) : undefined;
    const totalRaw = totalCol !== -1 ? row[totalCol] : undefined;
    const totalCellIsEmpty = totalRaw == null || String(totalRaw).trim() === "" || String(totalRaw).trim() === "-";
    let valorTotal = !totalCellIsEmpty ? parseNumericValue(totalRaw) : undefined;
    // Only calculate from valor*qtd if there's an explicit unit price AND total column is absent
    if (!valorTotal && valor && qtd && totalCol === -1) valorTotal = valor * qtd;

    const statusPag = statusCol !== -1 ? normalizeStatus(row[statusCol]) : undefined;
    const respRaw = respCol !== -1 ? String(row[respCol] || "").trim() : "";
    const formaPag = fPagtoCol !== -1 ? String(row[fPagtoCol] || "").trim() : undefined;
    const obs = obsCol !== -1 ? String(row[obsCol] || "").trim() : undefined;

    const dupeKey = `${dateVal}|${saborRaw.toLowerCase()}|${clienteRaw.toLowerCase()}`;
    if (seen.has(dupeKey)) warnings.push("Possível duplicidade");
    seen.add(dupeKey);

    const semanaRaw = semanaCol !== -1 ? String(row[semanaCol] || "").trim() : undefined;

    parsed.push({
      rowNum: r + 1,
      data: dateVal || String(row[dataCol]),
      semana: semanaRaw || undefined,
      sabor: saborRaw,
      quantidade: qtd ?? 0,
      valor: valor ?? undefined,
      valorTotal: valorTotal ?? undefined,
      statusPagamento: statusPag,
      responsavel: respRaw || undefined,
      cliente: clienteRaw || undefined,
      formaPagamento: formaPag || undefined,
      observacoes: obs || undefined,
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

  const prodMap = new Map<string, { quantidade: number; valor: number }>();
  for (const r of valid) {
    const key = r.sabor;
    const prev = prodMap.get(key) || { quantidade: 0, valor: 0 };
    prodMap.set(key, { quantidade: prev.quantidade + r.quantidade, valor: prev.valor + (r.valorTotal || 0) });
  }
  const porProduto = Array.from(prodMap.entries())
    .map(([sabor, v]) => ({ sabor, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade);

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
