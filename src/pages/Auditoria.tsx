import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Undo2, Loader2, AlertTriangle, Trash2, Eye, RotateCcw, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { realizarVenda } from "@/lib/supabase-helpers";

export default function Auditoria() {
  const { factoryId, role } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteImported, setConfirmDeleteImported] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingImported, setDeletingImported] = useState(false);

  // Vendas excluídas
  const [vendasExcluidas, setVendasExcluidas] = useState<any[]>([]);
  const [viewVenda, setViewVenda] = useState<any>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteExcluida, setConfirmDeleteExcluida] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "super_admin" && !factoryId) { setLogs([]); setVendasExcluidas([]); return; }
    loadData();
    loadVendasExcluidas();
  }, [factoryId, role]);

  async function loadData() {
    let q = (supabase as any).from("auditoria").select("*").order("created_at", { ascending: false }).limit(100);
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    setLogs(data || []);
  }

  async function loadVendasExcluidas() {
    let q = (supabase as any).from("vendas_excluidas").select("*").order("excluido_em", { ascending: false });
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    setVendasExcluidas(data || []);
  }

  async function handleRestoreVenda(ve: any) {
    setRestoringId(ve.id);
    try {
      // 1. Recreate the sale via RPC
      const itens = (ve.itens || []).filter((i: any) => i.sabor_id && i.quantidade > 0);
      if (itens.length === 0) throw new Error("Nenhum item válido para restaurar");

      const vendaId = await realizarVenda({
        p_cliente_id: ve.cliente_id,
        p_operador: ve.operador || "sistema",
        p_observacoes: `[RESTAURADA] ${ve.observacoes || ""}`,
        p_itens: itens.map((i: any) => ({ sabor_id: i.sabor_id, quantidade: i.quantidade })),
        p_parcelas: (ve.parcelas || []).length > 0
          ? ve.parcelas.map((p: any) => ({ valor: p.valor, vencimento: p.vencimento }))
          : null,
        p_ignorar_estoque: true,
      });

      // 2. Update the recreated sale with original values
      if (vendaId) {
        await (supabase as any).from("vendas").update({
          forma_pagamento: ve.forma_pagamento || "dinheiro",
          status: ve.status || "pendente",
          valor_pago: ve.valor_pago || 0,
          valor_pix: ve.valor_pix || 0,
          valor_especie: ve.valor_especie || 0,
          numero_nf: ve.numero_nf,
        }).eq("id", vendaId);
      }

      // 3. Remove from vendas_excluidas
      await (supabase as any).from("vendas_excluidas").delete().eq("id", ve.id);

      // 4. Audit
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "vendas",
        acao: "venda_restaurada",
        registro_afetado: vendaId,
        descricao: `Venda restaurada - Cliente: ${ve.cliente_nome} - R$ ${Number(ve.total).toFixed(2)}`,
        factory_id: ve.factory_id,
      });

      toast({ title: "Venda restaurada!", description: `A venda de R$ ${Number(ve.total).toFixed(2)} para ${ve.cliente_nome} foi restaurada com sucesso.` });
      loadVendasExcluidas();
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" });
    } finally {
      setRestoringId(null);
      setConfirmRestoreId(null);
    }
  }

  async function handleDeleteExcluidaPermanente(id: string) {
    try {
      await (supabase as any).from("vendas_excluidas").delete().eq("id", id);
      toast({ title: "Registro removido permanentemente" });
      loadVendasExcluidas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setConfirmDeleteExcluida(null);
    }
  }

  async function handleUndoImport(log: any) {
    setUndoingId(log.id);
    try {
      const rollbackMatch = log.descricao?.match(/\|\|ROLLBACK:(.+)$/);
      if (rollbackMatch) {
        const { producaoIds = [], vendaIds = [], stockChanges = [] } = JSON.parse(rollbackMatch[1]);
        await executeRollback(log.modulo, producaoIds, vendaIds, stockChanges, log.id);
        return;
      }
      const importTime = log.created_at;
      const tipo = log.modulo;

      if (tipo === "producao") {
        const { data: prods } = await (supabase as any).from("producoes")
          .select("id, sabor_id, quantidade_total")
          .ilike("observacoes", "%Importado via planilha%")
          .gte("created_at", new Date(new Date(importTime).getTime() - 60000).toISOString())
          .lte("created_at", new Date(new Date(importTime).getTime() + 300000).toISOString());
        if (!prods || prods.length === 0) {
          toast({ title: "Nenhum registro encontrado", variant: "destructive" });
          return;
        }
        const producaoIds = prods.map((p: any) => p.id);
        const stockChanges = prods.map((p: any) => ({ saborId: p.sabor_id, quantidade: p.quantidade_total }));
        await executeRollback("producao", producaoIds, [], stockChanges, log.id);
      } else {
        const { data: vendas } = await (supabase as any).from("vendas")
          .select("id")
          .ilike("observacoes", "%Importado via planilha%")
          .gte("created_at", new Date(new Date(importTime).getTime() - 60000).toISOString())
          .lte("created_at", new Date(new Date(importTime).getTime() + 300000).toISOString());
        if (!vendas || vendas.length === 0) {
          toast({ title: "Nenhum registro encontrado", variant: "destructive" });
          return;
        }
        const vendaIds = vendas.map((v: any) => v.id);
        const { data: itens } = await (supabase as any).from("venda_itens")
          .select("sabor_id, quantidade").in("venda_id", vendaIds);
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

  async function executeRollback(tipo: string, producaoIds: string[], vendaIds: string[], stockChanges: { saborId: string; quantidade: number }[], auditId: string) {
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
    await (supabase as any).from("auditoria").delete().eq("id", auditId);
    await (supabase as any).from("auditoria").insert({
      usuario_nome: "importação planilha", modulo: tipo, acao: "desfazer_importacao",
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
      toast({ title: "Registro excluído" });
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
      toast({ title: "Auditoria limpa" });
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
      const { data: importedProds } = await (supabase as any).from("producoes").select("id, sabor_id, quantidade_total").ilike("observacoes", "%Importado via planilha%");
      const { data: importedVendas } = await (supabase as any).from("vendas").select("id").ilike("observacoes", "%Importado via planilha%");
      const prodIds = (importedProds || []).map((p: any) => p.id);
      const vendaIds = (importedVendas || []).map((v: any) => v.id);
      if (prodIds.length > 0) {
        await (supabase as any).from("producao_funcionarios").delete().in("producao_id", prodIds);
        await (supabase as any).from("movimentacoes_estoque").delete().in("referencia_id", prodIds);
        await (supabase as any).from("producoes").delete().in("id", prodIds);
      }
      const saborTotals = new Map<string, number>();
      for (const p of (importedProds || [])) {
        saborTotals.set(p.sabor_id, (saborTotals.get(p.sabor_id) || 0) + p.quantidade_total);
      }
      for (const [saborId, qtd] of saborTotals) {
        const { data: estoque } = await (supabase as any).from("estoque_gelos").select("quantidade").eq("sabor_id", saborId).maybeSingle();
        if (estoque) {
          await (supabase as any).from("estoque_gelos").update({ quantidade: Math.max(0, estoque.quantidade - qtd) }).eq("sabor_id", saborId);
        }
      }
      if (vendaIds.length > 0) {
        await (supabase as any).from("venda_itens").delete().in("venda_id", vendaIds);
        await (supabase as any).from("venda_parcelas").delete().in("venda_id", vendaIds);
        await (supabase as any).from("movimentacoes_estoque").delete().in("referencia_id", vendaIds);
        await (supabase as any).from("vendas").delete().in("id", vendaIds);
      }
      await (supabase as any).from("auditoria").delete().eq("acao", "importar_planilha");
      await (supabase as any).from("auditoria").delete().eq("acao", "desfazer_importacao");
      toast({ title: "Dados importados removidos", description: `${prodIds.length} produções e ${vendaIds.length} vendas importadas foram apagadas.` });
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
            <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDeleteImported(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Apagar Importações
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteAll(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Apagar Logs
            </Button>
          </div>
        )}
      </div>

      {confirmDeleteImported && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm font-medium">Apagar TODAS as produções e vendas importadas via planilha?</span>
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
            <span className="text-sm font-medium">Apagar TODOS os {logs.length} registros de log?</span>
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
            <span className="text-sm">Desfazer esta importação? Registros e estoque serão revertidos.</span>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>Cancelar</Button>
              <Button size="sm" variant="destructive" disabled={undoingId === confirmId} onClick={() => { const log = logs.find(l => l.id === confirmId); if (log) handleUndoImport(log); }}>
                {undoingId === confirmId ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Desfazendo...</> : "Confirmar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {deleteConfirmId && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">Excluir este registro de auditoria?</span>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
              <Button size="sm" variant="destructive" disabled={deletingId === deleteConfirmId} onClick={() => handleDeleteLog(deleteConfirmId)}>
                {deletingId === deleteConfirmId ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Excluindo...</> : "Confirmar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">📋 Logs de Auditoria</TabsTrigger>
          <TabsTrigger value="lixeira" className="flex items-center gap-1">
            🗑️ Lixeira de Vendas
            {vendasExcluidas.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">{vendasExcluidas.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
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
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={undoingId === l.id} onClick={() => setConfirmId(l.id)}>
                              {undoingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Undo2 className="h-4 w-4 mr-1" /> Desfazer</>}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(l.id)}>
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
        </TabsContent>

        <TabsContent value="lixeira">
          {confirmRestoreId && (
            <Alert className="mb-4 border-primary/30 bg-primary/5">
              <RotateCcw className="h-4 w-4 text-primary" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm font-medium">Restaurar esta venda? Uma nova venda será criada com os mesmos dados.</span>
                <div className="flex gap-2 ml-4 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setConfirmRestoreId(null)}>Cancelar</Button>
                  <Button size="sm" disabled={restoringId === confirmRestoreId} onClick={() => { const ve = vendasExcluidas.find(v => v.id === confirmRestoreId); if (ve) handleRestoreVenda(ve); }}>
                    {restoringId === confirmRestoreId ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Restaurando...</> : "Restaurar"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {confirmDeleteExcluida && (
            <Alert className="mb-4 border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">Excluir permanentemente? Não será possível restaurar.</span>
                <div className="flex gap-2 ml-4 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDeleteExcluida(null)}>Cancelar</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteExcluidaPermanente(confirmDeleteExcluida)}>Excluir</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent className="pt-6">
              {vendasExcluidas.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Nenhuma venda excluída</p>
                  <p className="text-sm mt-1">Vendas excluídas aparecerão aqui para restauração.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Excluída em</TableHead>
                      <TableHead>Data da Venda</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasExcluidas.map((ve) => (
                      <TableRow key={ve.id}>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(ve.excluido_em).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{ve.data_venda ? new Date(ve.data_venda).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell className="font-medium">{ve.cliente_nome}</TableCell>
                        <TableCell className="font-semibold">R$ {Number(ve.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(ve.itens || []).slice(0, 3).map((it: any, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {it.quantidade}x {it.sabor_nome}
                              </Badge>
                            ))}
                            {(ve.itens || []).length > 3 && <Badge variant="outline" className="text-xs">+{(ve.itens || []).length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{ve.forma_pagamento || "-"}</Badge></TableCell>
                        <TableCell><Badge variant={ve.status === "paga" ? "default" : "secondary"} className="text-xs">{ve.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setViewVenda(ve)} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setConfirmRestoreId(ve.id)} title="Restaurar venda">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDeleteExcluida(ve.id)} title="Excluir permanentemente">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de detalhes da venda excluída */}
      <Dialog open={!!viewVenda} onOpenChange={(o) => !o && setViewVenda(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda Excluída</DialogTitle>
          </DialogHeader>
          {viewVenda && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{viewVenda.cliente_nome}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">R$ {Number(viewVenda.total).toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Data da Venda:</span> {viewVenda.data_venda ? new Date(viewVenda.data_venda).toLocaleDateString("pt-BR") : "-"}</div>
                <div><span className="text-muted-foreground">Excluída em:</span> {new Date(viewVenda.excluido_em).toLocaleString("pt-BR")}</div>
                <div><span className="text-muted-foreground">Pagamento:</span> <Badge variant="outline" className="capitalize">{viewVenda.forma_pagamento || "-"}</Badge></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={viewVenda.status === "paga" ? "default" : "secondary"}>{viewVenda.status}</Badge></div>
                {viewVenda.numero_nf && <div><span className="text-muted-foreground">NF:</span> {viewVenda.numero_nf}</div>}
                {viewVenda.observacoes && <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> {viewVenda.observacoes}</div>}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Itens da Venda</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sabor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewVenda.itens || []).map((it: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{it.sabor_nome}</TableCell>
                        <TableCell className="text-right">{it.quantidade}</TableCell>
                        <TableCell className="text-right">R$ {Number(it.preco_unitario).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">R$ {Number(it.subtotal).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {(viewVenda.parcelas || []).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Parcelas</h4>
                  {viewVenda.parcelas.map((p: any, idx: number) => (
                    <div key={idx} className="text-sm flex justify-between">
                      <span>Parcela {p.numero} - {new Date(p.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                      <span className="font-medium">R$ {Number(p.valor).toFixed(2)} {p.paga ? "✅" : "⏳"}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewVenda(null)}>Fechar</Button>
                <Button onClick={() => { setViewVenda(null); setConfirmRestoreId(viewVenda.id); }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Restaurar Venda
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}