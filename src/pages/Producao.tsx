import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Pencil, Eye, TrendingUp, CalendarIcon } from "lucide-react";
import Chart3DBarProducao from "@/components/Chart3DBarProducao";

export default function Producao() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [topProduzidos, setTopProduzidos] = useState<{ nome: string; total: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [saborId, setSaborId] = useState("");
  const [modo, setModo] = useState<"lote" | "unidade">("lote");
  const [qtdLotes, setQtdLotes] = useState(1);
  const [qtdTotal, setQtdTotal] = useState(84);
  const [observacoes, setObservacoes] = useState("");
  const [dataProducao, setDataProducao] = useState<Date>(new Date());
  const [funcList, setFuncList] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editProd, setEditProd] = useState<any>(null);
  const [editObs, setEditObs] = useState("");
  const [editOperador, setEditOperador] = useState("");
  const [editSaborId, setEditSaborId] = useState("");
  const [editModo, setEditModo] = useState<"lote" | "unidade">("lote");
  const [editQtdLotes, setEditQtdLotes] = useState(1);
  const [editQtdTotal, setEditQtdTotal] = useState(84);
  const [editDataProducao, setEditDataProducao] = useState<Date>(new Date());
  const [editFuncList, setEditFuncList] = useState<string[]>([""]);
  const [editLoading, setEditLoading] = useState(false);

  // Detail
  const [detailProd, setDetailProd] = useState<any>(null);
  const [detailFuncs, setDetailFuncs] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (modo === "lote") setQtdTotal(qtdLotes * 84);
  }, [qtdLotes, modo]);

  async function loadData() {
    const [s, f, p] = await Promise.all([
      (supabase as any).from("sabores").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("funcionarios").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("producoes").select("*, sabores(nome)").order("created_at", { ascending: false }).limit(100),
    ]);
    setSabores(s.data || []);
    setFuncionarios(f.data || []);
    setProducoes(p.data || []);

    // Top 5 sabores mais produzidos
    const saborMap: Record<string, { nome: string; total: number }> = {};
    (p.data || []).forEach((item: any) => {
      const nome = item.sabores?.nome || "?";
      if (!saborMap[nome]) saborMap[nome] = { nome, total: 0 };
      saborMap[nome].total += item.quantidade_total;
    });
    const sorted = Object.values(saborMap).sort((a, b) => b.total - a.total).slice(0, 5);
    setTopProduzidos(sorted);
  }

  function addFunc() { setFuncList([...funcList, ""]); }
  function removeFunc(i: number) { setFuncList(funcList.filter((_, idx) => idx !== i)); }
  function updateFunc(i: number, val: string) { const list = [...funcList]; list[i] = val; setFuncList(list); }

  function resetForm() {
    setSaborId(""); setModo("lote"); setQtdLotes(1); setQtdTotal(84); setObservacoes(""); setFuncList([""]); setDataProducao(new Date());
  }

  async function handleSubmit() {
    if (!saborId) return toast({ title: "Selecione um sabor", variant: "destructive" });
    const validFuncs = funcList.filter(f => f !== "");
    if (validFuncs.length === 0) return toast({ title: "Adicione ao menos um responsável", variant: "destructive" });

    const nomesFuncionarios = validFuncs.map(f => funcionarios.find(fn => fn.id === f)?.nome).filter(Boolean).join(", ");

    setLoading(true);
    try {
      await realizarProducao({
        p_sabor_id: saborId, p_modo: modo,
        p_quantidade_lotes: modo === "lote" ? qtdLotes : 0,
        p_quantidade_total: qtdTotal,
        p_operador: nomesFuncionarios || "sistema",
        p_observacoes: observacoes,
        p_funcionarios: validFuncs.map(f => ({ funcionario_id: f, quantidade_produzida: 0 })),
      });

      // Atualizar a data se diferente de hoje
      const hoje = new Date();
      if (dataProducao.toDateString() !== hoje.toDateString()) {
        const { data: latestProd } = await (supabase as any)
          .from("producoes").select("id").order("created_at", { ascending: false }).limit(1);
        if (latestProd?.[0]) {
          await (supabase as any).from("producoes").update({ created_at: dataProducao.toISOString() }).eq("id", latestProd[0].id);
        }
      }
      toast({ title: "Produção registrada com sucesso!" });
      setOpen(false); resetForm(); loadData();
    } catch (e: any) {
      toast({ title: "Erro na produção", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function openEditDialog(p: any) {
    setEditProd(p);
    setEditObs(p.observacoes || "");
    setEditOperador(p.operador || "");
    setEditSaborId(p.sabor_id || "");
    setEditModo(p.modo || "lote");
    setEditQtdLotes(p.quantidade_lotes || 1);
    setEditQtdTotal(p.quantidade_total || 84);
    setEditDataProducao(new Date(p.created_at));
    // Load associated funcionarios
    const { data } = await (supabase as any).from("producao_funcionarios").select("funcionario_id").eq("producao_id", p.id);
    setEditFuncList(data?.length ? data.map((d: any) => d.funcionario_id) : [""]);
    setEditOpen(true);
  }

  function addEditFunc() { setEditFuncList([...editFuncList, ""]); }
  function removeEditFunc(i: number) { setEditFuncList(editFuncList.filter((_, idx) => idx !== i)); }
  function updateEditFunc(i: number, val: string) { const list = [...editFuncList]; list[i] = val; setEditFuncList(list); }

  async function handleEditSave() {
    if (!editProd) return;
    if (!editSaborId) return toast({ title: "Selecione um sabor", variant: "destructive" });
    const validFuncs = editFuncList.filter(f => f !== "");
    if (validFuncs.length === 0) return toast({ title: "Adicione ao menos um responsável", variant: "destructive" });

    const nomesFuncionarios = validFuncs.map(f => funcionarios.find(fn => fn.id === f)?.nome).filter(Boolean).join(", ");
    const finalQtdTotal = editModo === "lote" ? editQtdLotes * 84 : editQtdTotal;

    setEditLoading(true);
    try {
      const { error } = await (supabase as any).from("producoes").update({
        sabor_id: editSaborId,
        modo: editModo,
        quantidade_lotes: editModo === "lote" ? editQtdLotes : 0,
        quantidade_total: finalQtdTotal,
        observacoes: editObs || null,
        operador: nomesFuncionarios || "sistema",
        created_at: editDataProducao.toISOString(),
      }).eq("id", editProd.id);
      if (error) throw error;

      // Update funcionarios: delete old, insert new
      await (supabase as any).from("producao_funcionarios").delete().eq("producao_id", editProd.id);
      if (validFuncs.length > 0) {
        await (supabase as any).from("producao_funcionarios").insert(
          validFuncs.map(f => ({ producao_id: editProd.id, funcionario_id: f, quantidade_produzida: 0 }))
        );
      }

      toast({ title: "Produção atualizada!" });
      setEditOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  }

  async function openDetailDialog(p: any) {
    setDetailProd(p);
    const { data } = await (supabase as any).from("producao_funcionarios").select("*, funcionarios(nome)").eq("producao_id", p.id);
    setDetailFuncs(data || []);
    setDetailOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      // Delete associated records first
      await (supabase as any).from("producao_funcionarios").delete().eq("producao_id", deleteId);
      const { error } = await (supabase as any).from("producoes").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Produção excluída!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produção</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Produção</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Produção</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data da Produção</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !dataProducao && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataProducao ? format(dataProducao, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataProducao}
                      onSelect={(d) => d && setDataProducao(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div><Label>Sabor</Label>
                <Select value={saborId} onValueChange={setSaborId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Modo</Label>
                <Select value={modo} onValueChange={(v) => setModo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lote">Lote (84 un.)</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modo === "lote" ? (
                <div><Label>Qtd. Lotes</Label><Input type="number" min={1} value={qtdLotes} onChange={(e) => setQtdLotes(Number(e.target.value))} /><p className="text-xs text-muted-foreground mt-1">Total: {qtdLotes * 84} gelos</p></div>
              ) : (
                <div><Label>Qtd. Total</Label><Input type="number" min={1} value={qtdTotal} onChange={(e) => setQtdTotal(Number(e.target.value))} /></div>
              )}
              <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Responsáveis</Label>
                  <Button size="sm" variant="outline" onClick={addFunc}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {funcList.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Select value={f} onValueChange={(v) => updateFunc(i, v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                      <SelectContent>{funcionarios.map((fn) => <SelectItem key={fn.id} value={fn.id}>{fn.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => removeFunc(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>{loading ? "Processando..." : "Registrar Produção"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Produção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data da Produção</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(editDataProducao, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editDataProducao} onSelect={(d) => d && setEditDataProducao(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Sabor</Label>
              <Select value={editSaborId} onValueChange={setEditSaborId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modo</Label>
              <Select value={editModo} onValueChange={(v) => setEditModo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lote">Lote (84 un.)</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editModo === "lote" ? (
              <div>
                <Label>Qtd. Lotes</Label>
                <Input type="number" min={1} value={editQtdLotes} onChange={(e) => setEditQtdLotes(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">Total: {editQtdLotes * 84} gelos</p>
              </div>
            ) : (
              <div>
                <Label>Qtd. Total</Label>
                <Input type="number" min={1} value={editQtdTotal} onChange={(e) => setEditQtdTotal(Number(e.target.value))} />
              </div>
            )}
            <div><Label>Observações</Label><Input value={editObs} onChange={(e) => setEditObs(e.target.value)} /></div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Responsáveis</Label>
                <Button size="sm" variant="outline" onClick={addEditFunc}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              {editFuncList.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Select value={f} onValueChange={(v) => updateEditFunc(i, v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                    <SelectContent>{funcionarios.map((fn) => <SelectItem key={fn.id} value={fn.id}>{fn.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => removeEditFunc(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da Produção</DialogTitle></DialogHeader>
          {detailProd && (
            <div className="space-y-3">
              <p><strong>Sabor:</strong> {detailProd.sabores?.nome}</p>
              <p><strong>Data:</strong> {new Date(detailProd.created_at).toLocaleDateString("pt-BR")}</p>
              <p><strong>Modo:</strong> {detailProd.modo}</p>
              <p><strong>Lotes:</strong> {detailProd.quantidade_lotes}</p>
              <p><strong>Total:</strong> {detailProd.quantidade_total} un.</p>
              <p><strong>Operador:</strong> {detailProd.operador}</p>
              {detailProd.observacoes && <p><strong>Obs:</strong> {detailProd.observacoes}</p>}
              {detailFuncs.length > 0 && (
                <div>
                  <strong>Funcionários:</strong>
                  <ul className="list-disc ml-5 mt-1">
                    {detailFuncs.map(f => <li key={f.id}>{f.funcionarios?.nome}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produção?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não reverte o estoque automaticamente. Ajuste o estoque manualmente se necessário.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Top 5 Sabores Mais Produzidos - 3D Chart */}
      {topProduzidos.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-lg">📊</span>
              Top 5 Sabores Mais Produzidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Chart3DBarProducao data={topProduzidos} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico de Produções</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const grouped: Record<string, typeof producoes> = {};
            producoes.forEach((p) => {
              const day = new Date(p.created_at).toLocaleDateString("pt-BR");
              if (!grouped[day]) grouped[day] = [];
              grouped[day].push(p);
            });
            const days = Object.keys(grouped);
            if (days.length === 0) return <p className="text-center text-muted-foreground py-4">Nenhuma produção.</p>;
            return days.map((day) => {
              const dayItems = grouped[day];
              const dayTotal = dayItems.reduce((s, p) => s + p.quantidade_total, 0);
              // Consolidar por sabor
              const saborMap: Record<string, number> = {};
              dayItems.forEach((p) => {
                const nome = p.sabores?.nome || "?";
                saborMap[nome] = (saborMap[nome] || 0) + p.quantidade_total;
              });
              return (
                <div key={day} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">📅 {day}</span>
                    <Badge variant="default" className="font-bold text-xs">Total: {dayTotal.toLocaleString("pt-BR")} un</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(saborMap).map(([nome, qtd]) => (
                      <Badge key={nome} variant="outline" className="text-xs font-medium gap-1">
                        {nome} <span className="font-bold text-primary">{qtd.toLocaleString("pt-BR")} un</span>
                      </Badge>
                    ))}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sabor</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead>Lotes</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayItems.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.sabores?.nome}</TableCell>
                          <TableCell className="capitalize">{p.modo}</TableCell>
                          <TableCell>{p.quantidade_lotes}</TableCell>
                          <TableCell>{p.quantidade_total}</TableCell>
                          <TableCell>{p.operador}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="icon" variant="ghost" onClick={() => openDetailDialog(p)}><Eye className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            });
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
