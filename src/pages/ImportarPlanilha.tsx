import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao, realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Upload, Eye, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

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

const EXPECTED_PRODUCTION_COLS = ["data", "sabor", "quantidade"];
const EXPECTED_SALES_COLS = ["data", "sabor", "quantidade", "cliente"];

function normalizeHeader(h: string): string {
  return h
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function parseDate(val: any): string | null {
  if (!val) return null;
  // Excel serial date
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const str = String(val).trim();
  // dd/mm/yyyy
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // yyyy-mm-dd
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return str;
  return null;
}

function parseQuantity(val: any): number | null {
  if (val == null || val === "") return null;
  const n = Number(String(val).replace(",", "."));
  return isNaN(n) ? null : Math.round(n);
}

export default function ImportarPlanilha() {
  const [tipoImportacao, setTipoImportacao] = useState<"producao" | "vendas" | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState<{ ok: number; fail: number } | null>(null);

  const [sabores, setSabores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

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
  }

  const handlePreview = useCallback(async () => {
    if (!file || !tipoImportacao) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (raw.length < 2) {
      toast({ title: "Planilha vazia", description: "A planilha não contém dados.", variant: "destructive" });
      return;
    }

    const headers = raw[0].map((h: any) => normalizeHeader(String(h)));
    const expected = tipoImportacao === "producao" ? EXPECTED_PRODUCTION_COLS : EXPECTED_SALES_COLS;
    const missing = expected.filter(e => !headers.includes(e));
    if (missing.length > 0) {
      toast({
        title: "Colunas obrigatórias ausentes",
        description: `Faltam: ${missing.join(", ")}`,
        variant: "destructive",
      });
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

    for (let r = 1; r < raw.length; r++) {
      const row = raw[r];
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
        rowNum: r + 1,
        data: dateVal || String(row[colIdx["data"]]),
        sabor: saborRaw,
        quantidade: qtd ?? 0,
        responsavel: respRaw || undefined,
        cliente: clienteRaw || undefined,
        errors,
        warnings,
        saborId,
        clienteId,
      });
    }

    setRows(parsed);
    setPreviewLoaded(true);
  }, [file, tipoImportacao, sabores, clientes]);

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);
  const totalQtd = validRows.reduce((s, r) => s + r.quantidade, 0);
  const hasBlockingErrors = errorRows.length > 0;

  async function handleImport() {
    if (hasBlockingErrors) return;
    setImporting(true);
    let ok = 0;
    let fail = 0;

    // Group by date+sabor for production, or process individually for sales
    if (tipoImportacao === "producao") {
      for (const row of validRows) {
        try {
          // Find a funcionario for responsavel or use first available
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
      // Group sales by date+client
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

    // Audit log
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
    toast({
      title: "Importação concluída",
      description: `${ok} registros importados, ${fail} erros.`,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Importar Planilha Oficial</h1>

      {importDone && importSummary ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
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
          {/* Step 1: Type + File */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Configuração</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Importação</Label>
                  <Select value={tipoImportacao} onValueChange={(v) => { setTipoImportacao(v as any); setPreviewLoaded(false); setRows([]); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producao">Produção</SelectItem>
                      <SelectItem value="vendas">Vendas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Arquivo Excel (.xlsx / .xls)</Label>
                  <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
                </div>
              </div>

              {tipoImportacao && (
                <Alert>
                  <AlertDescription>
                    <strong>Colunas obrigatórias:</strong>{" "}
                    {tipoImportacao === "producao"
                      ? "Data, Sabor, Quantidade (opcional: Responsável)"
                      : "Data, Sabor, Quantidade, Cliente"}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handlePreview}
                disabled={!file || !tipoImportacao}
                className="w-full md:w-auto"
              >
                <Eye className="h-4 w-4 mr-2" /> Visualizar Dados
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Preview */}
          {previewLoaded && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold">{rows.length}</p>
                    <p className="text-xs text-muted-foreground">Total de registros</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{validRows.length}</p>
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

              {/* Errors Alert */}
              {hasBlockingErrors && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Existem <strong>{errorRows.length}</strong> registro(s) com erro. Corrija a planilha e tente novamente.
                  </AlertDescription>
                </Alert>
              )}

              {/* Data Table */}
              <Card>
                <CardHeader><CardTitle>Pré-visualização dos Dados</CardTitle></CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado na planilha.</p>
                  ) : (
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Linha</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Sabor</TableHead>
                            <TableHead>Quantidade</TableHead>
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
                                  <Badge variant="outline" className="text-green-600 border-green-600">
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

              {/* Confirm Import */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetAll}>Cancelar</Button>
                <Button
                  onClick={handleImport}
                  disabled={hasBlockingErrors || importing || validRows.length === 0}
                >
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
