import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao, realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle2, AlertTriangle, XCircle,
  FileSpreadsheet, Loader2, Factory, ShoppingCart,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  type ImportRow, type TipoImportacao, type LayoutType,
  detectLayout, detectTipo, unpivotMatrix, unpivotWide, parseRows, buildAnalise,
} from "@/lib/spreadsheet-helpers";
import AnaliseResumoCard from "@/components/importar/AnaliseResumoCard";

interface SheetData {
  sheetName: string;
  tipo: TipoImportacao;
  layoutType: LayoutType;
  headers: string[];
  dataRows: any[][];
  rows: ImportRow[];
  analise: ReturnType<typeof buildAnalise> | null;
}

const TARGET_SHEETS: { name: string; aliases: string[]; tipo: TipoImportacao }[] = [
  { name: "PRODUÇÃO", aliases: ["producao", "produção", "production"], tipo: "producao" },
  { name: "VENDAS", aliases: ["vendas", "venda", "sales"], tipo: "vendas" },
];

function findTargetSheet(sheetNames: string[], target: typeof TARGET_SHEETS[0]): string | null {
  for (const sn of sheetNames) {
    const norm = sn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm === target.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) return sn;
    if (target.aliases.some(a => norm === a || norm.startsWith(a))) return sn;
  }
  return null;
}

export default function ImportarPlanilha() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [sheetSelectionPending, setSheetSelectionPending] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

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
    setFile(null); setWorkbook(null); setAvailableSheetNames([]);
    setSheetSelectionPending(false); setSheets([]); setActiveSheet("");
    setImportDone(false); setImportSummary(null);
  }

  function processSheet(wb: XLSX.WorkBook, sheetName: string, tipo: TipoImportacao): SheetData | null {
    const ws = wb.Sheets[sheetName];
    if (!ws) return null;
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (raw.length < 2) return null;

    const detected = detectLayout(raw, sabores);
    let headers: string[], dataRows: any[][];

    if (detected.layout === "wide" && detected.flavorCols) {
      const u = unpivotWide(raw, detected.flavorCols, sabores);
      headers = u.headers; dataRows = u.dataRows;
    } else if (detected.layout === "matrix" && detected.orientation) {
      const u = unpivotMatrix(raw, detected.orientation);
      headers = u.headers; dataRows = u.dataRows;
    } else {
      headers = raw[0].map(String); dataRows = raw.slice(1);
    }

    const rows = parseRows(tipo, headers, dataRows, sabores, clientes);
    const analise = rows.length > 0 ? buildAnalise(rows) : null;

    return { sheetName, tipo, layoutType: detected.layout, headers, dataRows, rows, analise };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext || "")) {
      toast({ title: "Arquivo inválido", description: "Apenas .xlsx ou .xls são aceitos.", variant: "destructive" });
      return;
    }
    setFile(f); setImportDone(false); setImportSummary(null); setSheets([]);
    setSheetSelectionPending(false); setWorkbook(null); setAvailableSheetNames([]);

    f.arrayBuffer().then(buf => {
      const wb = XLSX.read(buf, { type: "array", cellDates: false });

      if (wb.SheetNames.length > 1) {
        // Multiple sheets — ask the user to pick (show up to first 3)
        setWorkbook(wb);
        setAvailableSheetNames(wb.SheetNames.slice(0, 3));
        setSheetSelectionPending(true);
        toast({
          title: `${wb.SheetNames.length} aba(s) encontrada(s)`,
          description: "Selecione a aba que deseja importar.",
        });
      } else {
        // Single sheet — process directly
        processAndSetSheets(wb, wb.SheetNames[0]);
      }
    });
  }

  function processAndSetSheets(wb: XLSX.WorkBook, selectedSheetName: string) {
    // Try named target sheets first
    const foundSheets: SheetData[] = [];
    for (const target of TARGET_SHEETS) {
      if (selectedSheetName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() ===
          target.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
        const sd = processSheet(wb, selectedSheetName, target.tipo);
        if (sd && sd.rows.length > 0) foundSheets.push(sd);
      }
    }

    // Fallback: auto-detect
    if (foundSheets.length === 0) {
      const ws = wb.Sheets[selectedSheetName];
      if (ws) {
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (raw.length >= 2) {
          const detected = detectLayout(raw, sabores);
          let headers: string[], dataRows: any[][];
          if (detected.layout === "wide" && detected.flavorCols) {
            const u = unpivotWide(raw, detected.flavorCols, sabores);
            headers = u.headers; dataRows = u.dataRows;
          } else if (detected.layout === "matrix" && detected.orientation) {
            const u = unpivotMatrix(raw, detected.orientation);
            headers = u.headers; dataRows = u.dataRows;
          } else {
            headers = raw[0].map(String); dataRows = raw.slice(1);
          }
          const d = detectTipo(headers);
          const tipo = d.tipo || "producao";
          const rows = parseRows(tipo, headers, dataRows, sabores, clientes);
          if (rows.length > 0) {
            foundSheets.push({
              sheetName: selectedSheetName, tipo, layoutType: detected.layout,
              headers, dataRows, rows, analise: buildAnalise(rows),
            });
          }
        }
      }
    }

    if (foundSheets.length === 0) {
      toast({
        title: "Nenhum dado válido encontrado",
        description: `A aba "${selectedSheetName}" não contém dados reconhecíveis.`,
        variant: "destructive",
      });
      return;
    }

    setSheetSelectionPending(false);
    setSheets(foundSheets);
    setActiveSheet(foundSheets[0].sheetName);
    toast({
      title: `Aba "${selectedSheetName}" carregada`,
      description: `${foundSheets[0].rows.length} registros encontrados.`,
    });
  }

  function handleSelectSheet(sheetName: string) {
    if (!workbook) return;
    processAndSetSheets(workbook, sheetName);
  }

  const currentSheet = sheets.find(s => s.sheetName === activeSheet);
  const tipoImportacao = currentSheet?.tipo || null;
  const rows = currentSheet?.rows || [];
  const analise = currentSheet?.analise || null;
  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);
  const totalQtd = validRows.reduce((s, r) => s + r.quantidade, 0);
  const hasBlockingErrors = errorRows.length > 0;
  const hasValor = analise ? analise.totalValor > 0 : false;

  async function handleImport() {
    if (hasBlockingErrors || !tipoImportacao || !currentSheet) return;
    setImporting(true);
    let ok = 0, fail = 0;
    const errors: string[] = [];

    if (tipoImportacao === "producao") {
      for (const row of validRows) {
        try {
          let funcId = funcionarios[0]?.id;
          if (row.responsavel) {
            const found = funcionarios.find(f => f.nome.toLowerCase() === row.responsavel!.toLowerCase());
            if (found) funcId = found.id;
          }

          const { data: prod, error: prodErr } = await (supabase as any)
            .from("producoes")
            .insert({
              sabor_id: row.saborId!,
              modo: "unidade",
              quantidade_lotes: 0,
              quantidade_total: row.quantidade,
              operador: row.responsavel || "importação planilha",
              observacoes: `Importado via planilha - ${file?.name || ""}`,
              created_at: row.data ? `${row.data}T12:00:00Z` : new Date().toISOString(),
            })
            .select("id")
            .single();

          if (prodErr) throw prodErr;

          if (funcId && prod?.id) {
            await (supabase as any).from("producao_funcionarios").insert({
              producao_id: prod.id, funcionario_id: funcId, quantidade_produzida: 0,
            });
          }

          const { data: estoque } = await (supabase as any)
            .from("estoque_gelos").select("quantidade").eq("sabor_id", row.saborId!).maybeSingle();

          if (estoque) {
            await (supabase as any).from("estoque_gelos")
              .update({ quantidade: estoque.quantidade + row.quantidade }).eq("sabor_id", row.saborId!);
          } else {
            await (supabase as any).from("estoque_gelos")
              .insert({ sabor_id: row.saborId!, quantidade: row.quantidade });
          }

          await (supabase as any).from("movimentacoes_estoque").insert({
            tipo_item: "gelo_pronto", item_id: row.saborId!, tipo_movimentacao: "entrada",
            quantidade: row.quantidade, operador: row.responsavel || "importação planilha",
            referencia: "producao", referencia_id: prod?.id,
          });

          ok++;
        } catch (e: any) {
          fail++;
          errors.push(`Linha ${row.rowNum} (${row.sabor}): ${e.message}`);
        }
      }
    } else {
      // Auto-create missing clients
      const missingClients = new Set<string>();
      for (const row of validRows) {
        if (row.cliente && !row.clienteId) missingClients.add(row.cliente.trim());
      }
      const createdClientMap = new Map<string, string>();
      for (const nome of missingClients) {
        try {
          const { data: newClient, error: clientErr } = await (supabase as any)
            .from("clientes").insert({ nome, status: "ativo" }).select("id").single();
          if (clientErr) throw clientErr;
          createdClientMap.set(nome.toLowerCase(), newClient.id);
        } catch (e: any) {
          console.error(`Erro ao criar cliente "${nome}":`, e.message);
        }
      }
      for (const row of validRows) {
        if (row.cliente && !row.clienteId) {
          row.clienteId = createdClientMap.get(row.cliente.toLowerCase());
        }
      }

      const groups = new Map<string, ImportRow[]>();
      for (const row of validRows) {
        if (!row.clienteId) { fail++; continue; }
        const key = `${row.data}|${row.clienteId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      for (const [, items] of groups) {
        try {
          await realizarVenda({
            p_cliente_id: items[0].clienteId!, p_operador: "importação planilha",
            p_observacoes: `Importado via planilha - ${file?.name || ""}`,
            p_itens: items.map(i => ({ sabor_id: i.saborId!, quantidade: i.quantidade })),
          });
          ok += items.length;
        } catch (e: any) {
          fail += items.length;
          errors.push(`Venda ${items[0].data} - ${items[0].cliente}: ${e.message}`);
        }
      }
    }

    try {
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "importação planilha",
        modulo: tipoImportacao === "producao" ? "producao" : "vendas",
        acao: "importar_planilha",
        descricao: `Importação ${file?.name} [${currentSheet.sheetName}]: ${ok} OK, ${fail} erros. Total: ${totalQtd} un.`,
      });
    } catch {}

    setImportSummary({ ok, fail, errors }); setImportDone(true); setImporting(false);
    if (fail > 0 && errors.length > 0) {
      toast({ title: "Importação com erros", description: errors.slice(0, 3).join("; "), variant: "destructive" });
    } else {
      toast({ title: "Importação concluída!", description: `${ok} registros importados com sucesso.` });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Upload Planilha</h1>

      {importDone && importSummary ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Importação Concluída</h2>
            <p className="text-muted-foreground">
              <strong>{importSummary.ok}</strong> registros importados
              {importSummary.fail > 0 && <>, <strong className="text-destructive">{importSummary.fail}</strong> erros</>}
            </p>
            {importSummary.errors.length > 0 && (
              <div className="mt-4 text-left max-w-lg mx-auto">
                <p className="text-sm font-semibold text-destructive mb-2 text-center">Detalhes dos erros:</p>
                <div className="max-h-60 overflow-auto rounded border border-border bg-muted/50 p-3 space-y-1">
                  {importSummary.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={resetAll} variant="outline">Nova Importação</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upload */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Upload do Arquivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo Excel (.xlsx / .xls)</Label>
                <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Arquivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  {sheets.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {sheets.length} aba(s): {sheets.map(s => s.sheetName).join(", ")}
                    </Badge>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sheet Selection */}
          {sheetSelectionPending && availableSheetNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" /> Selecione a Aba
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  A planilha possui múltiplas abas. Selecione qual deseja importar:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {availableSheetNames.map((name, idx) => (
                    <Button
                      key={name}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-1"
                      onClick={() => handleSelectSheet(name)}
                    >
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{name}</span>
                      <span className="text-xs text-muted-foreground">Aba {idx + 1}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sheet Tabs */}
          {sheets.length > 0 && (
            <Tabs value={activeSheet} onValueChange={setActiveSheet}>
              {sheets.length > 1 && (
                <TabsList className="w-full">
                  {sheets.map(s => (
                    <TabsTrigger key={s.sheetName} value={s.sheetName} className="flex-1 gap-2">
                      {s.tipo === "producao" ? <Factory className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                      {s.sheetName} ({s.rows.length})
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}

              {sheets.map(sheet => (
                <TabsContent key={sheet.sheetName} value={sheet.sheetName}>
                  <SheetPreview
                    sheet={sheet}
                    importing={importing}
                    onImport={handleImport}
                    onCancel={resetAll}
                    fileName={file?.name}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}

function SheetPreview({ sheet, importing, onImport, onCancel, fileName }: {
  sheet: SheetData;
  importing: boolean;
  onImport: () => void;
  onCancel: () => void;
  fileName?: string;
}) {
  const { tipo: tipoImportacao, rows, analise, layoutType } = sheet;
  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);
  const hasBlockingErrors = errorRows.length > 0;
  const hasValor = analise ? analise.totalValor > 0 : false;

  return (
    <div className="space-y-6">
      {/* Info */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          Aba: <strong>{sheet.sheetName}</strong>
          <Badge variant="secondary" className="gap-1">
            {tipoImportacao === "producao" ? <Factory className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
            {tipoImportacao === "producao" ? "Produção" : "Vendas"}
          </Badge>
          {layoutType === "matrix" && <Badge variant="outline">Matricial</Badge>}
          {layoutType === "wide" && <Badge variant="outline">Wide (Sabores em Colunas)</Badge>}
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      {analise && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="py-4 text-center">
              <Badge variant="secondary" className="mb-2 gap-1">
                {tipoImportacao === "producao" ? <Factory className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                {tipoImportacao === "producao" ? "Produção" : "Vendas"}
              </Badge>
              <p className="text-xs text-muted-foreground">Tipo</p>
            </CardContent></Card>
            <Card><CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{analise.totalRegistros}</p>
              <p className="text-xs text-muted-foreground">Total registros</p>
            </CardContent></Card>
            <Card><CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-secondary">{analise.totalValidos}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </CardContent></Card>
            <Card><CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-destructive">{analise.totalErros}</p>
              <p className="text-xs text-muted-foreground">Com erros</p>
            </CardContent></Card>
            <Card><CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{analise.totalQuantidade}</p>
              <p className="text-xs text-muted-foreground">Total unidades</p>
            </CardContent></Card>
          </div>

          {hasValor && (
            <Card><CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-primary">{analise.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              <p className="text-sm text-muted-foreground">Faturamento Total</p>
            </CardContent></Card>
          )}

          {hasBlockingErrors && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{errorRows.length}</strong> registro(s) com erro. Corrija a planilha e tente novamente.
              </AlertDescription>
            </Alert>
          )}

          <AnaliseResumoCard analise={analise} tipo={tipoImportacao} />
        </>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader><CardTitle>Pré-visualização dos Dados</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  {rows.some(r => r.semana) && <TableHead className="bg-accent/20 font-semibold">📆 Semana</TableHead>}
                  <TableHead className="bg-primary/10 font-semibold">📅 Data</TableHead>
                  <TableHead>Sabor</TableHead>
                  <TableHead>Qtd</TableHead>
                  {hasValor && <TableHead>Valor Un.</TableHead>}
                  {hasValor && <TableHead>Total</TableHead>}
                  {tipoImportacao === "vendas" && <TableHead>Cliente</TableHead>}
                  {tipoImportacao === "producao" && <TableHead>Responsável</TableHead>}
                  {rows.some(r => r.statusPagamento) && <TableHead>Pagamento</TableHead>}
                  {rows.some(r => r.formaPagamento) && <TableHead>F. Pagto</TableHead>}
                  {rows.some(r => r.observacoes) && <TableHead>Obs</TableHead>}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.rowNum} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                    <TableCell>{row.rowNum}</TableCell>
                    {rows.some(r => r.semana) && <TableCell className="bg-accent/10 font-medium">{row.semana || "-"}</TableCell>}
                    <TableCell className="bg-primary/5 font-medium whitespace-nowrap">{row.data}</TableCell>
                    <TableCell>{row.sabor}</TableCell>
                    <TableCell>{row.quantidade}</TableCell>
                    {hasValor && <TableCell>{row.valor != null ? `R$ ${row.valor.toFixed(2)}` : "-"}</TableCell>}
                    {hasValor && <TableCell>{row.valorTotal != null ? `R$ ${row.valorTotal.toFixed(2)}` : "-"}</TableCell>}
                    {tipoImportacao === "vendas" && <TableCell>{row.cliente || "-"}</TableCell>}
                    {tipoImportacao === "producao" && <TableCell>{row.responsavel || "-"}</TableCell>}
                    {rows.some(r => r.statusPagamento) && (
                      <TableCell>
                        {row.statusPagamento ? (
                          <Badge variant={
                            row.statusPagamento === "Pago" ? "default" :
                            row.statusPagamento === "Atrasado" ? "destructive" : "secondary"
                          }>{row.statusPagamento}</Badge>
                        ) : "-"}
                      </TableCell>
                    )}
                    {rows.some(r => r.formaPagamento) && (
                      <TableCell>{row.formaPagamento || "-"}</TableCell>
                    )}
                    {rows.some(r => r.observacoes) && (
                      <TableCell className="max-w-[200px] truncate text-xs" title={row.observacoes || ""}>{row.observacoes || "-"}</TableCell>
                    )}
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <div className="space-y-1">
                          {row.errors.map((e, i) => <Badge key={i} variant="destructive" className="text-xs mr-1">{e}</Badge>)}
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
        </CardContent>
      </Card>

      {/* Confirm */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onImport} disabled={hasBlockingErrors || importing || validRows.length === 0}>
          {importing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" /> Confirmar Importação ({validRows.length} registros)</>
          )}
        </Button>
      </div>
    </div>
  );
}
