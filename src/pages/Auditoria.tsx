import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Undo2, Loader2, AlertTriangle, Trash2 } from "lucide-react";

export default function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteImported, setConfirmDeleteImported] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingImported, setDeletingImported] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await (supabase as any).from("auditoria").select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
  }

  async function handleUndoImport(log: any) {
    setUndoingId(log.id);
    try {
      // Strategy 1: Has rollback data embedded
      const rollbackMatch = log.descricao?.match(/\|\|ROLLBACK:(.+)$/);
      if (rollbackMatch) {
        const { producaoIds = [], vendaIds = [], stockChanges = [] } = JSON.parse(rollbackMatch[1]);
        await executeRollback(log.modulo, producaoIds, vendaIds, stockChanges, log.id);
        return;
      }

      // Strategy 2: Find records by timestamp (for old imports without rollback data)
      const importTime = log.created_at;
      const tipo = log.modulo;

      if (tipo === "producao") {
        // Find producoes created around the import time with "Importado via planilha" in observacoes
        const { data: prods } = await (supabase as any).from("producoes")
          .select("id, sabor_id, quantidade_total")
          .ilike("observacoes", "%Importado via planilha%")
          .gte("created_at", new Date(new Date(importTime).getTime() - 60000).toISOString())
          .lte("created_at", new Date(new Date(importTime).getTime() + 300000).toISOString());

        if (!prods || prods.length === 0) {
          toast({ title: "Nenhum registro encontrado", description: "Não foi possível encontrar os registros desta importação.", variant: "destructive" });
          return;
        }

        const producaoIds = prods.map((p: any) => p.id);
        const stockChanges = prods.map((p: any) => ({ saborId: p.sabor_id, quantidade: p.quantidade_total }));
        await executeRollback("producao", producaoIds, [], stockChanges, log.id);
      } else {
        // Find vendas created around the import time with "Importado via planilha" in observacoes
        const { data: vendas } = await (supabase as any).from("vendas")
          .select("id")
          .ilike("observacoes", "%Importado via planilha%")
          .gte("created_at", new Date(new Date(importTime).getTime() - 60000).toISOString())
          .lte("created_at", new Date(new Date(importTime).getTime() + 300000).toISOString());

        if (!vendas || vendas.length === 0) {
          toast({ title: "Nenhum registro encontrado", description: "Não foi possível encontrar as vendas desta importação.", variant: "destructive" });
          return;
        }

        const vendaIds = vendas.map((v: any) => v.id);

        // Get items to reverse stock
        const { data: itens } = await (supabase as any).from("venda_itens")
          .select("sabor_id, quantidade")
          .in("venda_id", vendaIds);

        const stockChanges = (itens || []).map((i: any) => ({ saborId: i.sabor_id, quantidade: i.quantidade }));
        await executeRollback("vendas", [], vendaIds, stockChanges, log.id);
      }
    } catch (e: any) {
      toast({ title: "Erro ao desfazer", description: e.message, variant: "destructive" });
    } finally {
      setUndoingId(null);
      setConfirmId(null);
    }
  }

  async function executeRollback(
    tipo: string,
    producaoIds: string[],
    vendaIds: string[],
    stockChanges: { saborId: string; quantidade: number }[],
    auditId: string,
  ) {
    if (tipo === "producao" && producaoIds.length > 0) {
      await (supabase as any).from("producao_funcionarios").delete().in("producao_id", producaoIds);
      await (supabase as any).from("movimentacoes_estoque").delete().in("referencia_id", producaoIds);
      await (supabase as any).from("producoes").delete().in("id", producaoIds);
    }
    if (tipo === "vendas" && vendaIds.length > 0) {
      await (supabase as any).from("venda_itens").delete().in("venda_id", vendaIds);
      await (supabase as any).from("venda_parcelas").delete().in("venda_id", vendaIds);
      await (supabase as any).from("vendas").delete().in("id", vendaIds);
    }

    // Reverse stock
    const saborTotals = new Map<string, number>();
    for (const sc of stockChanges) {
      saborTotals.set(sc.saborId, (saborTotals.get(sc.saborId) || 0) + sc.quantidade);
    }
    for (const [saborId, qtd] of saborTotals) {
      const { data: estoque } = await (supabase as any)
        .from("estoque_gelos").select("quantidade").eq("sabor_id", saborId).maybeSingle();
      if (estoque) {
        await (supabase as any).from("estoque_gelos")
          .update({ quantidade: Math.max(0, estoque.quantidade - qtd) }).eq("sabor_id", saborId);
      }
      await (supabase as any).from("movimentacoes_estoque").insert({
        tipo_item: "gelo_pronto", item_id: saborId, tipo_movimentacao: "saida",
        quantidade: qtd, operador: "desfazer importação", referencia: "rollback_importacao",
      });
    }

    // Update audit
    await (supabase as any).from("auditoria").delete().eq("id", auditId);
    await (supabase as any).from("auditoria").insert({
      usuario_nome: "importação planilha",
      modulo: tipo,
      acao: "desfazer_importacao",
      descricao: `Importação desfeita: ${producaoIds.length + vendaIds.length} registros removidos, estoque revertido.`,
    });

    toast({ title: "Importação desfeita!", description: "Registros removidos e estoque revertido." });
    loadData();
  }

  function cleanDescription(desc: string | null) {
    if (!desc) return "-";
    return desc.includes("||ROLLBACK:") ? desc.split("||ROLLBACK:")[0].trim() : desc;
  }

  async function handleDeleteLog(id: string) {
    setDeletingId(id);
    try {
      await (supabase as any).from("auditoria").delete().eq("id", id);
      toast({ title: "Registro excluído", description: "O registro de auditoria foi removido." });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await (supabase as any).from("auditoria").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      toast({ title: "Auditoria limpa", description: "Todos os registros foram excluídos." });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao limpar", description: e.message, variant: "destructive" });
    } finally {
      setDeletingAll(false);
      setConfirmDeleteAll(false);
    }
  }

  async function handleDeleteImported() {
    setDeletingImported(true);
    try {
      // 1. Find all imported productions
      const { data: importedProds } = await (supabase as any)
        .from("producoes")
        .select("id, sabor_id, quantidade_total")
        .ilike("observacoes", "%Importado via planilha%");

      // 2. Find all imported sales
      const { data: importedVendas } = await (supabase as any)
        .from("vendas")
        .select("id")
        .ilike("observacoes", "%Importado via planilha%");

      const prodIds = (importedProds || []).map((p: any) => p.id);
      const vendaIds = (importedVendas || []).map((v: any) => v.id);

      // 3. Delete production related records
      if (prodIds.length > 0) {
        await (supabase as any).from("producao_funcionarios").delete().in("producao_id", prodIds);
        await (supabase as any).from("movimentacoes_estoque").delete().in("referencia_id", prodIds);
        await (supabase as any).from("producoes").delete().in("id", prodIds);
      }

      // 4. Revert stock from imported productions
      const saborTotals = new Map<string, number>();
      for (const p of (importedProds || [])) {
        saborTotals.set(p.sabor_id, (saborTotals.get(p.sabor_id) || 0) + p.quantidade_total);
      }
      for (const [saborId, qtd] of saborTotals) {
        const { data: estoque } = await (supabase as any)
          .from("estoque_gelos").select("quantidade").eq("sabor_id", saborId).maybeSingle();
        if (estoque) {
          await (supabase as any).from("estoque_gelos")
            .update({ quantidade: Math.max(0, estoque.quantidade - qtd) }).eq("sabor_id", saborId);
        }
      }

      // 5. Delete sale related records
      if (vendaIds.length > 0) {
        await (supabase as any).from("venda_itens").delete().in("venda_id", vendaIds);
        await (supabase as any).from("venda_parcelas").delete().in("venda_id", vendaIds);
        await (supabase as any).from("movimentacoes_estoque").delete().in("referencia_id", vendaIds);
        await (supabase as any).from("vendas").delete().in("id", vendaIds);
      }

      // 6. Clean audit entries related to imports
      await (supabase as any).from("auditoria").delete().eq("acao", "importar_planilha");
      await (supabase as any).from("auditoria").delete().eq("acao", "desfazer_importacao");

      toast({
        title: "Dados importados removidos",
        description: `${prodIds.length} produções e ${vendaIds.length} vendas importadas foram apagadas. Estoque revertido.`,
      });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao limpar importações", description: e.message, variant: "destructive" });
    } finally {
      setDeletingImported(false);
      setConfirmDeleteImported(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Auditoria</h1>
        {logs.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDeleteImported(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Apagar Importações
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDeleteAll(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Apagar Logs
            </Button>
          </div>
        )}
      </div>

      {confirmDeleteImported && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Apagar TODAS as produções e vendas importadas via planilha? O estoque será revertido.
            </span>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteImported(false)}>Cancelar</Button>
              <Button size="sm" variant="destructive" disabled={deletingImported} onClick={handleDeleteImported}>
                {deletingImported ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Apagando...</> : "Confirmar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {confirmDeleteAll && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Apagar TODOS os {logs.length} registros de log da auditoria? (Não apaga produções/vendas)
            </span>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Cancelar</Button>
              <Button size="sm" variant="destructive" disabled={deletingAll} onClick={handleDeleteAll}>
                {deletingAll ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Apagando...</> : "Confirmar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {confirmId && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              Tem certeza que deseja desfazer esta importação? Isso removerá todos os registros e reverterá o estoque.
            </span>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>Cancelar</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={undoingId === confirmId}
                onClick={() => {
                  const log = logs.find(l => l.id === confirmId);
                  if (log) handleUndoImport(log);
                }}
              >
                {undoingId === confirmId ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Desfazendo...</>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {deleteConfirmId && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              Tem certeza que deseja excluir este registro de auditoria?
            </span>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={deletingId === deleteConfirmId}
                onClick={() => handleDeleteLog(deleteConfirmId)}
              >
                {deletingId === deleteConfirmId ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Excluindo...</>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{l.usuario_nome}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{l.modulo}</Badge></TableCell>
                  <TableCell className="capitalize">{l.acao}</TableCell>
                  <TableCell className="max-w-xs truncate">{cleanDescription(l.descricao)}</TableCell>
                  <TableCell>{l.dispositivo}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {l.acao === "importar_planilha" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={undoingId === l.id}
                          onClick={() => setConfirmId(l.id)}
                        >
                          {undoingId === l.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Undo2 className="h-4 w-4 mr-1" /> Desfazer</>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirmId(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
