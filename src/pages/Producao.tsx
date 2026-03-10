import { useEffect, useState, useMemo } from "react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isAfter, isBefore, addDays } from "date-fns";
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
import { Plus, Trash2, Pencil, Eye, TrendingUp, CalendarIcon, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Chart3DBarProducao from "@/components/Chart3DBarProducao";
import ChecklistProducaoDia from "@/components/producao/ChecklistProducaoDia";
import EditDayProducoesDialog from "@/components/producao/EditDayProducoesDialog";

export default function Producao() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [chartPeriodo, setChartPeriodo] = useState<"dia" | "semana" | "mes">("mes");
  const [chartDate, setChartDate] = useState<Date>(new Date());
  const [chartView, setChartView] = useState<"top5" | "todos">("top5");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDayItems, setDeleteDayItems] = useState<any[] | null>(null);
  const [editDayItems, setEditDayItems] = useState<any[] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  interface ProdItem {
    sabor_id: string;
    sabor_nome: string;
    modo: "lote" | "unidade";
    qtdLotes: number;
    qtdTotal: number;
  }

  const [prodItens, setProdItens] = useState<ProdItem[]>([]);
  const [saborId, setSaborId] = useState("");
  const [modo, setModo] = useState<"lote" | "unidade">("lote");
  const [qtdLotes, setQtdLotes] = useState(6);
  const [qtdTotal, setQtdTotal] = useState(504);
  const [observacoes, setObservacoes] = useState("");
  const [ignorarEstoque, setIgnorarEstoque] = useState(false);
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

  }

  // Helper: semanas do mês começando no dia 1
  function getMonthWeek(date: Date): { start: Date; end: Date } {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const dayOfMonth = date.getDate();
    const weekIndex = Math.floor((dayOfMonth - 1) / 7);
    const start = new Date(monthStart);
    start.setDate(1 + weekIndex * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    if (end > monthEnd) return { start, end: monthEnd };
    return { start, end: endOfDay(end) };
  }

  const topProduzidos = useMemo(() => {
    let start: Date;
    let end: Date;
    if (chartPeriodo === "dia") {
      start = startOfDay(chartDate);
      end = endOfDay(chartDate);
    } else if (chartPeriodo === "semana") {
      const w = getMonthWeek(chartDate);
      start = startOfDay(w.start);
      end = endOfDay(w.end);
    } else {
      start = startOfMonth(chartDate);
      end = endOfMonth(chartDate);
    }

    const filtered = producoes.filter(p => {
      const d = new Date(p.created_at);
      return !isBefore(d, start) && !isAfter(d, end);
    });
    const saborMap: Record<string, { nome: string; total: number }> = {};
    filtered.forEach((item: any) => {
      const nome = item.sabores?.nome || "?";
      if (!saborMap[nome]) saborMap[nome] = { nome, total: 0 };
      saborMap[nome].total += item.quantidade_total;
    });
    return Object.values(saborMap).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [producoes, chartPeriodo, chartDate]);

  const todosProduzidos = useMemo(() => {
    let start: Date;
    let end: Date;
    if (chartPeriodo === "dia") {
      start = startOfDay(chartDate);
      end = endOfDay(chartDate);
    } else if (chartPeriodo === "semana") {
      const w = getMonthWeek(chartDate);
      start = startOfDay(w.start);
      end = endOfDay(w.end);
    } else {
      start = startOfMonth(chartDate);
      end = endOfMonth(chartDate);
    }
    const filtered = producoes.filter(p => {
      const d = new Date(p.created_at);
      return !isBefore(d, start) && !isAfter(d, end);
    });
    const saborMap: Record<string, { nome: string; total: number }> = {};
    filtered.forEach((item: any) => {
      const nome = item.sabores?.nome || "?";
      if (!saborMap[nome]) saborMap[nome] = { nome, total: 0 };
      saborMap[nome].total += item.quantidade_total;
    });
    return Object.values(saborMap).sort((a, b) => b.total - a.total);
  }, [producoes, chartPeriodo, chartDate]);

  const chartPeriodoLabel = useMemo(() => {
    if (chartPeriodo === "dia") return format(chartDate, "dd/MM/yyyy");
    if (chartPeriodo === "semana") {
      const w = getMonthWeek(chartDate);
      return `${format(w.start, "dd/MM")} a ${format(w.end, "dd/MM")}`;
    }
    return format(chartDate, "MMMM yyyy", { locale: ptBR });
  }, [chartDate, chartPeriodo]);

  function addFunc() { setFuncList([...funcList, ""]); }
  function removeFunc(i: number) { setFuncList(funcList.filter((_, idx) => idx !== i)); }
  function updateFunc(i: number, val: string) { const list = [...funcList]; list[i] = val; setFuncList(list); }

  function resetForm() {
    setSaborId(""); setModo("lote"); setQtdLotes(1); setQtdTotal(84); setObservacoes(""); setFuncList([""]); setDataProducao(new Date()); setProdItens([]); setIgnorarEstoque(false);
  }

  function addProdItem() {
    if (!saborId) return toast({ title: "Selecione um sabor", variant: "destructive" });
    if (prodItens.some(i => i.sabor_id === saborId)) return toast({ title: "Sabor já adicionado", variant: "destructive" });
    const sabor = sabores.find(s => s.id === saborId);
    if (!sabor) return;
    const total = modo === "lote" ? qtdLotes * 84 : qtdTotal;
    setProdItens([...prodItens, { sabor_id: saborId, sabor_nome: sabor.nome, modo, qtdLotes, qtdTotal: total }]);
    setSaborId(""); setModo("lote"); setQtdLotes(1); setQtdTotal(84);
  }

  function removeProdItem(idx: number) {
    setProdItens(prodItens.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (prodItens.length === 0) return toast({ title: "Adicione ao menos um sabor", variant: "destructive" });
    const validFuncs = funcList.filter(f => f !== "");
    if (validFuncs.length === 0) return toast({ title: "Adicione ao menos um responsável", variant: "destructive" });

    const nomesFuncionarios = validFuncs.map(f => funcionarios.find(fn => fn.id === f)?.nome).filter(Boolean).join(", ");

    setLoading(true);
    try {
      for (const item of prodItens) {
        await realizarProducao({
          p_sabor_id: item.sabor_id, p_modo: item.modo,
          p_quantidade_lotes: item.modo === "lote" ? item.qtdLotes : 0,
          p_quantidade_total: item.qtdTotal,
          p_operador: nomesFuncionarios || "sistema",
          p_observacoes: observacoes,
          p_funcionarios: validFuncs.map(f => ({ funcionario_id: f, quantidade_produzida: 0 })),
          p_ignorar_estoque: ignorarEstoque,
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
      }
      toast({ title: `${prodItens.length} produção(ões) registrada(s) com sucesso!` });
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

  async function handleDeleteDay() {
    if (!deleteDayItems || deleteDayItems.length === 0) return;
    try {
      for (const p of deleteDayItems) {
        await (supabase as any).from("producao_funcionarios").delete().eq("producao_id", p.id);
        await (supabase as any).from("producoes").delete().eq("id", p.id);
      }
      toast({ title: `${deleteDayItems.length} produção(ões) do dia excluídas!` });
      setDeleteDayItems(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produção</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Produção</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto pb-6">
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
              {/* Adicionar sabores */}
              <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                <Label className="text-base font-semibold">Sabores a Produzir</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs">Sabor</Label>
                    <Select value={saborId} onValueChange={setSaborId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Modo</Label>
                      <Select value={modo} onValueChange={(v) => setModo(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lote">Lote (84 un.)</SelectItem>
                          <SelectItem value="unidade">Unidade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {modo === "lote" ? (
                        <>
                          <Label className="text-xs">Qtd. Lotes</Label>
                          <Input type="number" min={1} value={qtdLotes} onChange={(e) => setQtdLotes(Number(e.target.value))} />
                          <p className="text-xs text-muted-foreground mt-1">= {qtdLotes * 84} gelos</p>
                        </>
                      ) : (
                        <>
                          <Label className="text-xs">Qtd. Total</Label>
                          <Input type="number" min={1} value={qtdTotal} onChange={(e) => setQtdTotal(Number(e.target.value))} />
                        </>
                      )}
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={addProdItem} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Sabor
                  </Button>
                </div>
                {prodItens.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sabor</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prodItens.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.sabor_nome}</TableCell>
                          <TableCell className="capitalize text-xs">{item.modo === "lote" ? `${item.qtdLotes} lote(s)` : "unidade"}</TableCell>
                          <TableCell className="text-right">{item.qtdTotal}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeProdItem(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Responsáveis</Label>
                  <Button size="sm" variant="outline" onClick={addFunc}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {funcList.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Select value={f} onValueChange={(v) => updateFunc(i, v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Colaborador" /></SelectTrigger>
                      <SelectContent>{funcionarios.map((fn) => <SelectItem key={fn.id} value={fn.id}>{fn.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => removeFunc(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <Checkbox id="ignorar-estoque" checked={ignorarEstoque} onCheckedChange={(v) => setIgnorarEstoque(!!v)} />
                <Label htmlFor="ignorar-estoque" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Ignorar validação de estoque (lançamento retroativo)
                </Label>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading || prodItens.length === 0}>{loading ? "Processando..." : `Registrar ${prodItens.length} Produção(ões)`}</Button>
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
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Colaborador" /></SelectTrigger>
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
                  <strong>Colaboradores:</strong>
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

      {/* Delete Day Confirm */}
      <AlertDialog open={!!deleteDayItems} onOpenChange={(v) => !v && setDeleteDayItems(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar toda produção do dia?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão excluídos {deleteDayItems?.length || 0} registro(s) de produção. Esta ação não reverte o estoque automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDay} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Top 5 Sabores Mais Produzidos - 3D Chart */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">📊</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setChartView(prev => prev === "top5" ? "todos" : "top5")}>◀</Button>
                  <span>{chartView === "top5" ? "Top 5 Sabores Mais Produzidos" : "Todos os Sabores Produzidos"}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setChartView(prev => prev === "top5" ? "todos" : "top5")}>▶</Button>
                </div>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {(["dia", "semana", "mes"] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={chartPeriodo === p ? "default" : "outline"}
                    onClick={() => setChartPeriodo(p)}
                    className="text-xs h-7 px-3"
                  >
                    {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mês"}
                  </Button>
                ))}
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    if (chartPeriodo === "dia") setChartDate(prev => addDays(prev, -1));
                    else if (chartPeriodo === "semana") setChartDate(prev => {
                      const w = getMonthWeek(prev);
                      const newDate = addDays(w.start, -1);
                      return newDate < startOfMonth(prev) ? new Date(prev.getFullYear(), prev.getMonth() - 1, 28) : newDate;
                    });
                    else setChartDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}>←</Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 min-w-[100px]">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {chartPeriodoLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" selected={chartDate} onSelect={(d) => d && setChartDate(d)} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    if (chartPeriodo === "dia") setChartDate(prev => addDays(prev, 1));
                    else if (chartPeriodo === "semana") setChartDate(prev => {
                      const w = getMonthWeek(prev);
                      const newDate = addDays(w.end, 1);
                      return newDate > endOfMonth(prev) ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : newDate;
                    });
                    else setChartDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}>→</Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const currentData = chartView === "top5" ? topProduzidos : todosProduzidos;
              if (currentData.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma produção neste período.</p>;
              return (
                <>
                  <div className="text-center mb-2">
                    <span className="text-xs text-muted-foreground">Quantidade Total no Período:</span>
                    <span className="ml-2 text-lg font-bold text-primary">
                      {currentData.reduce((s, i) => s + i.total, 0).toLocaleString("pt-BR")} un
                    </span>
                  </div>
                  <Chart3DBarProducao data={currentData} />
                </>
              );
            })()}
          </CardContent>
        </Card>

      {/* Edit Day Dialog */}
      <EditDayProducoesDialog
        open={!!editDayItems}
        onOpenChange={(v) => !v && setEditDayItems(null)}
        dayItems={editDayItems || []}
        sabores={sabores}
        funcionarios={funcionarios}
        onSaved={loadData}
      />

      {/* Checklist de Produção do Dia */}
      <ChecklistProducaoDia />

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
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">📅 {day}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        title="Adicionar sabores neste dia"
                        onClick={() => {
                          const [d, m, y] = day.split("/").map(Number);
                          const targetDate = new Date(y, m - 1, d);
                          resetForm();
                          // Set date after reset (use setTimeout to ensure state is updated)
                          setTimeout(() => {
                            setDataProducao(targetDate);
                            setOpen(true);
                          }, 0);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setEditDayItems(dayItems)}
                        title="Editar produções do dia"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setDeleteDayItems(dayItems)}
                        title="Apagar tudo do dia"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
