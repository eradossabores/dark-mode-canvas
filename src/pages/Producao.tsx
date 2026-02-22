import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Eye, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Producao() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [topVendidos, setTopVendidos] = useState<{ nome: string; total: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [saborId, setSaborId] = useState("");
  const [modo, setModo] = useState<"lote" | "unidade">("lote");
  const [qtdLotes, setQtdLotes] = useState(1);
  const [qtdTotal, setQtdTotal] = useState(84);
  const [observacoes, setObservacoes] = useState("");
  const [funcList, setFuncList] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editProd, setEditProd] = useState<any>(null);
  const [editObs, setEditObs] = useState("");
  const [editOperador, setEditOperador] = useState("");

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

    // Load top 5 most sold flavors
    const { data: vendaItens } = await (supabase as any)
      .from("venda_itens")
      .select("sabor_id, quantidade, sabores(nome)");
    const saborMap: Record<string, { nome: string; total: number }> = {};
    (vendaItens || []).forEach((item: any) => {
      const id = item.sabor_id;
      if (!saborMap[id]) saborMap[id] = { nome: item.sabores?.nome || "?", total: 0 };
      saborMap[id].total += item.quantidade;
    });
    const sorted = Object.values(saborMap).sort((a, b) => b.total - a.total).slice(0, 5);
    setTopVendidos(sorted);
  }

  function addFunc() { setFuncList([...funcList, ""]); }
  function removeFunc(i: number) { setFuncList(funcList.filter((_, idx) => idx !== i)); }
  function updateFunc(i: number, val: string) { const list = [...funcList]; list[i] = val; setFuncList(list); }

  function resetForm() {
    setSaborId(""); setModo("lote"); setQtdLotes(1); setQtdTotal(84); setObservacoes(""); setFuncList([""]);
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
      toast({ title: "Produção registrada com sucesso!" });
      setOpen(false); resetForm(); loadData();
    } catch (e: any) {
      toast({ title: "Erro na produção", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openEditDialog(p: any) {
    setEditProd(p);
    setEditObs(p.observacoes || "");
    setEditOperador(p.operador || "");
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editProd) return;
    try {
      const { error } = await (supabase as any).from("producoes").update({
        observacoes: editObs, operador: editOperador,
      }).eq("id", editProd.id);
      if (error) throw error;
      toast({ title: "Produção atualizada!" });
      setEditOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
      {/* Top 5 Sabores Mais Vendidos */}
      {topVendidos.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top 5 Sabores Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
              <div className="space-y-2">
                {topVendidos.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                      <span className="font-medium text-sm">{s.nome}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{s.total.toLocaleString("pt-BR")} un.</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topVendidos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="nome" type="category" width={90} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="total" name="Vendidos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produção</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Produção</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Produção</DialogTitle></DialogHeader>
            <div className="space-y-4">
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
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Produção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Operador</Label><Input value={editOperador} onChange={(e) => setEditOperador(e.target.value)} /></div>
            <div><Label>Observações</Label><Input value={editObs} onChange={(e) => setEditObs(e.target.value)} /></div>
            <Button className="w-full" onClick={handleEditSave}>Salvar</Button>
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

      <Card>
        <CardHeader><CardTitle>Histórico de Produções</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Sabor</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Lotes</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {producoes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
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
              {producoes.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma produção.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
