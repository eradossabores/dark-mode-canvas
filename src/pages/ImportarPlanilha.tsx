import { useEffect, useState, useCallback, useMemo } from "react";
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
  Upload, CheckCircle2, AlertTriangle, XCircle,
  FileSpreadsheet, Loader2, HelpCircle, Factory, ShoppingCart,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  type ImportRow, type TipoImportacao, type LayoutType,
  detectLayout, detectTipo, unpivotMatrix, parseRows, buildAnalise,
} from "@/lib/spreadsheet-helpers";
import AnaliseResumoCard from "@/components/importar/AnaliseResumoCard";

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
    setFile(null); setLayoutType("tabular"); setDetectedTipo(null); setDetectedConfidence("low");
    setConfirmedTipo(null); setParsedHeaders([]); setParsedDataRows([]);
    setRows([]); setPreviewLoaded(false); setImportDone(false); setImportSummary(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext || "")) {
      toast({ title: "Arquivo inválido", description: "Apenas .xlsx ou .xls são aceitos.", variant: "destructive" });
      return;
    }
    setFile(f); setPreviewLoaded(false); setImportDone(false); setImportSummary(null);
    setRows([]); setConfirmedTipo(null);

    f.arrayBuffer().then(buf => {
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (raw.length < 2) { toast({ title: "Planilha vazia", variant: "destructive" }); return; }

      const layout = detectLayout(raw);
      setLayoutType(layout);

      let headers: string[], dataRows: any[][];
      if (layout === "matrix") {
        const u = unpivotMatrix(raw);
        headers = u.headers; dataRows = u.dataRows;
      } else {
        headers = raw[0].map(String); dataRows = raw.slice(1);
      }

      setParsedHeaders(headers); setParsedDataRows(dataRows);

      if (layout === "matrix") {
        setDetectedTipo("producao"); setDetectedConfidence("high"); setConfirmedTipo("producao");
      } else {
        const d = detectTipo(headers);
        setDetectedTipo(d.tipo); setDetectedConfidence(d.confidence);
        if (d.confidence === "high" && d.tipo) setConfirmedTipo(d.tipo);
      }
    });
  }

  const handlePreview = useCallback(() => {
    if (!tipoImportacao || parsedDataRows.length === 0) return;
    const parsed = parseRows(tipoImportacao, parsedHeaders, parsedDataRows, sabores, clientes);
    if (parsed.length === 0) {
      toast({ title: "Colunas obrigatórias ausentes", description: "Verifique: Data, Sabor, Quantidade", variant: "destructive" });
      return;
    }
    setRows(parsed); setPreviewLoaded(true);
  }, [tipoImportacao, parsedHeaders, parsedDataRows, sabores, clientes]);

  useEffect(() => {
    if (confirmedTipo && parsedDataRows.length > 0 && !previewLoaded) handlePreview();
  }, [confirmedTipo, parsedDataRows, previewLoaded, handlePreview]);

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);
  const totalQtd = validRows.reduce((s, r) => s + r.quantidade, 0);
  const hasBlockingErrors = errorRows.length > 0;

  const analise = useMemo(() => rows.length > 0 ? buildAnalise(rows) : null, [rows]);
  const hasValor = analise ? analise.totalValor > 0 : false;

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
            p_sabor_id: row.saborId!, p_modo: "unidade", p_quantidade_lotes: 0,
            p_quantidade_total: row.quantidade, p_operador: row.responsavel || "importação planilha",
            p_observacoes: `Importado via planilha - ${file?.name || ""}`,
            p_funcionarios: funcId ? [{ funcionario_id: funcId, quantidade_produzida: 0 }] : [],
          });
          ok++;
        } catch (e: any) { fail++; console.error(`Erro linha ${row.rowNum}:`, e.message); }
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
            p_cliente_id: items[0].clienteId!, p_operador: "importação planilha",
            p_observacoes: `Importado via planilha - ${file?.name || ""}`,
            p_itens: items.map(i => ({ sabor_id: i.saborId!, quantidade: i.quantidade })),
          });
          ok += items.length;
        } catch (e: any) { fail += items.length; console.error("Erro venda:", e.message); }
      }
    }

    try {
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "importação planilha",
        modulo: tipoImportacao === "producao" ? "producao" : "vendas",
        acao: "importar_planilha",
        descricao: `Importação ${file?.name}: ${ok} OK, ${fail} erros. Total: ${totalQtd} un.`,
      });
    } catch {}

    setImportSummary({ ok, fail }); setImportDone(true); setImporting(false);
    toast({ title: "Importação concluída", description: `${ok} importados, ${fail} erros.` });
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
              <strong>{importSummary.ok}</strong> registros importados
              {importSummary.fail > 0 && <>, <strong className="text-destructive">{importSummary.fail}</strong> erros</>}
            </p>
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
                  {layoutType === "matrix" && <Badge variant="secondary" className="ml-2">Layout Matricial</Badge>}
                </p>
              )}

              {file && parsedHeaders.length > 0 && confirmedTipo && detectedConfidence === "high" && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="flex items-center gap-2">
                    Tipo identificado:
                    <Badge variant="secondary" className="gap-1">
                      {confirmedTipo === "producao" ? <Factory className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                      {confirmedTipo === "producao" ? "Produção" : "Vendas"}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setConfirmedTipo(null); setPreviewLoaded(false); setRows([]); }}>Alterar</Button>
                  </AlertDescription>
                </Alert>
              )}

              {needsManualConfirmation && (
                <Alert variant={detectedTipo ? "default" : "destructive"}>
                  <HelpCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-3">{detectedTipo ? `Sugestão: "${detectedTipo === "producao" ? "Produção" : "Vendas"}". Confirme:` : "Selecione o tipo:"}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setConfirmedTipo("producao"); setPreviewLoaded(false); setRows([]); }}><Factory className="h-4 w-4" /> Produção</Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setConfirmedTipo("vendas"); setPreviewLoaded(false); setRows([]); }}><ShoppingCart className="h-4 w-4" /> Vendas</Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Preview + Análise */}
          {previewLoaded && tipoImportacao && analise && (
            <>
              {/* KPIs */}
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

              {/* Análise Detalhada */}
              <AnaliseResumoCard analise={analise} tipo={tipoImportacao} />

              {/* Tabela de Dados */}
              <Card>
                <CardHeader><CardTitle>Pré-visualização dos Dados</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Sabor</TableHead>
                          <TableHead>Qtd</TableHead>
                          {hasValor && <TableHead>Valor Un.</TableHead>}
                          {hasValor && <TableHead>Total</TableHead>}
                          {tipoImportacao === "vendas" && <TableHead>Cliente</TableHead>}
                          {tipoImportacao === "producao" && <TableHead>Responsável</TableHead>}
                          {rows.some(r => r.statusPagamento) && <TableHead>Pagamento</TableHead>}
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
