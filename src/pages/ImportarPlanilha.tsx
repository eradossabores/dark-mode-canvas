import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao, realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import {
  Upload, Eye, CheckCircle2, AlertTriangle, XCircle,
  FileSpreadsheet, Loader2, HelpCircle, Factory, ShoppingCart,
} from "lucide-react";
import * as XLSX from "xlsx";

/* ───────── types ───────── */
interface ImportRow {
  rowNum: number;
  data: string;
  sabor: string;
  quantidade: number;
  responsavel?: string;
  cliente?: string;
  errors: string[];
  warnings: string[];
  saborId?: string;
  clienteId?: string;
}

type TipoImportacao = "producao" | "vendas";
type LayoutType = "matrix" | "tabular";

/* ───────── helpers ───────── */
const SALES_INDICATORS = ["valor", "preco", "total", "preço", "unitario", "unitário", "cliente", "faturamento"];

function normalizeText(h: string): string {
  return h.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

function parseDate(val: any): string | null {
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
  // dd/mm/yy
  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m3) return `20${m3[3]}-${m3[2].padStart(2, "0")}-${m3[1].padStart(2, "0")}`;
  return null;
}

function parseQuantity(val: any): number | null {
  if (val == null || val === "") return null;
  const n = Number(String(val).replace(",", "."));
  return isNaN(n) ? null : Math.round(n);
}

/** Detect if layout is matrix (dates as columns, flavors as rows) */
function detectLayout(raw: any[][]): LayoutType {
  if (raw.length < 2 || raw[0].length < 2) return "tabular";
  const headerRow = raw[0];
  // Check if columns B onwards look like dates
  let dateCount = 0;
  for (let c = 1; c < headerRow.length; c++) {
    if (parseDate(headerRow[c]) !== null) dateCount++;
  }
  // If most columns (>50%) after the first are dates, it's matrix
  if (dateCount > 0 && dateCount >= (headerRow.length - 1) * 0.5) return "matrix";
  return "tabular";
}

function detectTipo(headers: string[]): { tipo: TipoImportacao | null; confidence: "high" | "medium" | "low" } {
  const normalized = headers.map(h => h.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  let salesScore = 0;
  for (const h of normalized) {
    if (SALES_INDICATORS.some(s => h.includes(s))) salesScore++;
  }
  if (normalized.some(h => h === "cliente")) salesScore += 3;
  if (salesScore >= 2) return { tipo: "vendas", confidence: "high" };
  if (salesScore === 1) return { tipo: "vendas", confidence: "medium" };
  // Default: production (matrix of quantities without price = production)
  return { tipo: "producao", confidence: "medium" };
}

/** Unpivot matrix layout into flat rows */
function unpivotMatrix(raw: any[][]): { headers: string[]; dataRows: any[][] } {
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

/* ───────── component ───────── */
export default function ImportarPlanilha() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [layoutType, setLayoutType] = useState<LayoutType>("tabular");
  const [detectedTipo, setDetectedTipo] = useState<TipoImportacao | null>(null);
  const [detectedConfidence, setDetectedConfidence] = useState<"high" | "medium" | "low">("low");
  const [confirmedTipo, setConfirmedTipo] = useState<TipoImportacao | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedDataRows, setParsedDataRows] = useState<any[][]>([]);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState<{ ok: number; fail: number } | null>(null);

  const tipoImportacao = confirmedTipo;

  useEffect(() => {
    Promise.all([
      (supabase as any).from("sabores").select("id, nome").eq("ativo", true),
      (supabase as any).from("clientes").select("id, nome").eq("status", "ativo"),
      (supabase as any).from("funcionarios").select("id, nome").eq("ativo", true),
    ]).then(([s, c, f]) => {
      setSabores(s.data || []);
      setClientes(c.data || []);
      setFuncionarios(f.data || []);
    });
  }, []);

  function resetAll() {
    setFile(null);
    setLayoutType("tabular");
    setDetectedTipo(null);
    setDetectedConfidence("low");
    setConfirmedTipo(null);
    setParsedHeaders([]);
    setParsedDataRows([]);
    setRows([]);
    setPreviewLoaded(false);
    setImportDone(false);
    setImportSummary(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext || "")) {
      toast({ title: "Arquivo inválido", description: "Apenas .xlsx ou .xls são aceitos.", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreviewLoaded(false);
    setImportDone(false);
    setImportSummary(null);
    setRows([]);
    setConfirmedTipo(null);

    f.arrayBuffer().then(buf => {
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (raw.length < 2) {
        toast({ title: "Planilha vazia", description: "A planilha não contém dados.", variant: "destructive" });
        return;
      }

      const layout = detectLayout(raw);
      setLayoutType(layout);

      let headers: string[];
      let dataRows: any[][];

      if (layout === "matrix") {
        const unpivoted = unpivotMatrix(raw);
        headers = unpivoted.headers;
        dataRows = unpivoted.dataRows;
      } else {
        headers = raw[0].map(String);
        dataRows = raw.slice(1);
      }

      setParsedHeaders(headers);
      setParsedDataRows(dataRows);

      const detection = detectTipo(headers);
      setDetectedTipo(detection.tipo);
      setDetectedConfidence(detection.confidence);

      if (layout === "matrix") {
        // Matrix without price/client columns → production
        setConfirmedTipo("producao");
        setDetectedTipo("producao");
        setDetectedConfidence("high");
      } else if (detection.confidence === "high" && detection.tipo) {
        setConfirmedTipo(detection.tipo);
      }
    });
  }

  const handlePreview = useCallback(() => {
    if (!tipoImportacao || parsedDataRows.length === 0) return;

    const headers = parsedHeaders.map(h => normalizeText(h));
    const expected = tipoImportacao === "producao" ? ["data", "sabor", "quantidade"] : ["data", "sabor", "quantidade", "cliente"];
    const missing = expected.filter(e => !headers.includes(e));
    if (missing.length > 0) {
      toast({ title: "Colunas obrigatórias ausentes", description: `Faltam: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }

    const colIdx: Record<string, number> = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    const saborMap = new Map<string, string>();
    sabores.forEach(s => saborMap.set(s.nome.toLowerCase().trim(), s.id));
    const clienteMap = new Map<string, string>();
    clientes.forEach(c => clienteMap.set(c.nome.toLowerCase().trim(), c.id));

    const seen = new Set<string>();
    const parsed: ImportRow[] = [];

    for (let r = 0; r < parsedDataRows.length; r++) {
      const row = parsedDataRows[r];
      if (row.every((c: any) => c === "" || c == null)) continue;

      const errors: string[] = [];
      const warnings: string[] = [];

      const dateVal = parseDate(row[colIdx["data"]]);
      if (!dateVal) errors.push("Data inválida");

      const saborRaw = String(row[colIdx["sabor"]] || "").trim();
      const saborId = saborMap.get(saborRaw.toLowerCase());
      if (!saborRaw) errors.push("Sabor vazio");
      else if (!saborId) errors.push(`Sabor "${saborRaw}" não encontrado`);

      const qtd = parseQuantity(row[colIdx["quantidade"]]);
      if (qtd == null) errors.push("Quantidade inválida");
      else if (qtd <= 0) errors.push("Quantidade deve ser positiva");

      let clienteId: string | undefined;
      let clienteRaw = "";
      if (tipoImportacao === "vendas") {
        clienteRaw = String(row[colIdx["cliente"]] || "").trim();
        clienteId = clienteMap.get(clienteRaw.toLowerCase());
        if (!clienteRaw) errors.push("Cliente vazio");
        else if (!clienteId) errors.push(`Cliente "${clienteRaw}" não encontrado`);
      }

      const respRaw = colIdx["responsavel"] != null ? String(row[colIdx["responsavel"]] || "").trim() : "";

      const dupeKey = `${dateVal}|${saborRaw.toLowerCase()}|${clienteRaw.toLowerCase()}`;
      if (seen.has(dupeKey)) warnings.push("Possível duplicidade");
      seen.add(dupeKey);

      parsed.push({
        rowNum: r + 1, data: dateVal || String(row[colIdx["data"]]),
        sabor: saborRaw, quantidade: qtd ?? 0,
        responsavel: respRaw || undefined, cliente: clienteRaw || undefined,
        errors, warnings, saborId, clienteId,
      });
    }

    setRows(parsed);
    setPreviewLoaded(true);
  }, [tipoImportacao, parsedHeaders, parsedDataRows, sabores, clientes]);

  useEffect(() => {
    if (confirmedTipo && parsedDataRows.length > 0 && !previewLoaded) {
      handlePreview();
    }
  }, [confirmedTipo, parsedDataRows, previewLoaded, handlePreview]);

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);
  const totalQtd = validRows.reduce((s, r) => s + r.quantidade, 0);
  const hasBlockingErrors = errorRows.length > 0;

  async function handleImport() {
    if (hasBlockingErrors || !tipoImportacao) return;
    setImporting(true);
    let ok = 0, fail = 0;

    if (tipoImportacao === "producao") {
      for (const row of validRows) {
        try {
          let funcId = funcionarios[0]?.id;
          if (row.responsavel) {
            const found = funcionarios.find(f => f.nome.toLowerCase() === row.responsavel!.toLowerCase());
            if (found) funcId = found.id;
          }
          await realizarProducao({
            p_sabor_id: row.saborId!,
            p_modo: "unidade",
            p_quantidade_lotes: 0,
            p_quantidade_total: row.quantidade,
            p_operador: row.responsavel || "importação planilha",
            p_observacoes: `Importado via planilha - ${file?.name || ""}`,
            p_funcionarios: funcId ? [{ funcionario_id: funcId, quantidade_produzida: 0 }] : [],
          });
          ok++;
        } catch (e: any) {
          fail++;
          console.error(`Erro linha ${row.rowNum}:`, e.message);
        }
      }
    } else {
      const groups = new Map<string, ImportRow[]>();
      for (const row of validRows) {
        const key = `${row.data}|${row.clienteId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      for (const [, items] of groups) {
        try {
          await realizarVenda({
            p_cliente_id: items[0].clienteId!,
            p_operador: "importação planilha",
            p_observacoes: `Importado via planilha - ${file?.name || ""}`,
            p_itens: items.map(i => ({ sabor_id: i.saborId!, quantidade: i.quantidade })),
          });
          ok += items.length;
        } catch (e: any) {
          fail += items.length;
          console.error("Erro venda agrupada:", e.message);
        }
      }
    }

    try {
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "importação planilha",
        modulo: tipoImportacao === "producao" ? "producao" : "vendas",
        acao: "importar_planilha",
        descricao: `Importação de ${file?.name}: ${ok} registros OK, ${fail} erros. Total: ${totalQtd} unidades.`,
      });
    } catch {}

    setImportSummary({ ok, fail });
    setImportDone(true);
    setImporting(false);
    toast({ title: "Importação concluída", description: `${ok} registros importados, ${fail} erros.` });
  }

  const needsManualConfirmation = file && parsedHeaders.length > 0 && !confirmedTipo;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Upload Planilha</h1>

      {importDone && importSummary ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Importação Concluída</h2>
            <p className="text-muted-foreground">
              <strong>{importSummary.ok}</strong> registros importados com sucesso
              {importSummary.fail > 0 && <>, <strong className="text-destructive">{importSummary.fail}</strong> erros</>}
            </p>
            <Button onClick={resetAll} variant="outline">Nova Importação</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Upload do Arquivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo Excel (.xlsx / .xls)</Label>
                <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Arquivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  {layoutType === "matrix" && (
                    <Badge variant="secondary" className="ml-2">Layout Matricial Detectado</Badge>
                  )}
                </p>
              )}

              {/* Auto-detected with high confidence */}
              {file && parsedHeaders.length > 0 && confirmedTipo && detectedConfidence === "high" && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="flex items-center gap-2">
                    Tipo identificado automaticamente:
                    <Badge variant="secondary" className="gap-1">
                      {confirmedTipo === "producao" ? <Factory className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                      {confirmedTipo === "producao" ? "Produção" : "Vendas"}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setConfirmedTipo(null); setPreviewLoaded(false); setRows([]); }}>
                      Alterar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Needs manual confirmation */}
              {needsManualConfirmation && (
                <Alert variant={detectedTipo ? "default" : "destructive"}>
                  <HelpCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-3">
                      {detectedTipo
                        ? `O sistema sugere "${detectedTipo === "producao" ? "Produção" : "Vendas"}". Confirme o tipo:`
                        : "Não foi possível identificar o tipo automaticamente. Selecione:"}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setConfirmedTipo("producao"); setPreviewLoaded(false); setRows([]); }}>
                        <Factory className="h-4 w-4" /> Produção
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setConfirmedTipo("vendas"); setPreviewLoaded(false); setRows([]); }}>
                        <ShoppingCart className="h-4 w-4" /> Vendas
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {tipoImportacao && (
                <Alert>
                  <AlertDescription>
                    <strong>Colunas esperadas:</strong>{" "}
                    {tipoImportacao === "producao"
                      ? "Data, Sabor, Quantidade (opcional: Responsável)"
                      : "Data, Sabor, Quantidade, Cliente"}
                    {layoutType === "matrix" && (
                      <span className="block text-xs mt-1 text-muted-foreground">
                        Formato matricial: datas nas colunas, sabores nas linhas — convertido automaticamente.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {previewLoaded && tipoImportacao && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="py-4 text-center">
                    <Badge variant="secondary" className="mb-2 gap-1">
                      {tipoImportacao === "producao" ? <Factory className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                      {tipoImportacao === "producao" ? "Produção" : "Vendas"}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold">{rows.length}</p>
                    <p className="text-xs text-muted-foreground">Total registros</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-secondary">{validRows.length}</p>
                    <p className="text-xs text-muted-foreground">Válidos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-destructive">{errorRows.length}</p>
                    <p className="text-xs text-muted-foreground">Com erros</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold">{totalQtd}</p>
                    <p className="text-xs text-muted-foreground">Total unidades</p>
                  </CardContent>
                </Card>
              </div>

              {hasBlockingErrors && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Existem <strong>{errorRows.length}</strong> registro(s) com erro. Corrija a planilha e tente novamente.
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader><CardTitle>Pré-visualização dos Dados</CardTitle></CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado.</p>
                  ) : (
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Sabor</TableHead>
                            <TableHead>Qtd</TableHead>
                            {tipoImportacao === "producao" && <TableHead>Responsável</TableHead>}
                            {tipoImportacao === "vendas" && <TableHead>Cliente</TableHead>}
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.rowNum} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                              <TableCell>{row.rowNum}</TableCell>
                              <TableCell>{row.data}</TableCell>
                              <TableCell>{row.sabor}</TableCell>
                              <TableCell>{row.quantidade}</TableCell>
                              {tipoImportacao === "producao" && <TableCell>{row.responsavel || "-"}</TableCell>}
                              {tipoImportacao === "vendas" && <TableCell>{row.cliente || "-"}</TableCell>}
                              <TableCell>
                                {row.errors.length > 0 ? (
                                  <div className="space-y-1">
                                    {row.errors.map((e, i) => (
                                      <Badge key={i} variant="destructive" className="text-xs mr-1">{e}</Badge>
                                    ))}
                                  </div>
                                ) : row.warnings.length > 0 ? (
                                  <div className="space-y-1">
                                    {row.warnings.map((w, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs mr-1">
                                        <AlertTriangle className="h-3 w-3 mr-1" />{w}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-secondary border-secondary">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />OK
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetAll}>Cancelar</Button>
                <Button onClick={handleImport} disabled={hasBlockingErrors || importing || validRows.length === 0}>
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Confirmar Importação ({validRows.length} registros)</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
