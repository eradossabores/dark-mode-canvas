import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function Producao() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const [saborId, setSaborId] = useState("");
  const [modo, setModo] = useState<"lote" | "unidade">("lote");
  const [qtdLotes, setQtdLotes] = useState(1);
  const [qtdTotal, setQtdTotal] = useState(84);
  
  const [observacoes, setObservacoes] = useState("");
  const [funcList, setFuncList] = useState<{ funcionario_id: string; quantidade_produzida: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (modo === "lote") {
      setQtdTotal(qtdLotes * 84);
    }
  }, [qtdLotes, modo]);

  async function loadData() {
    const [s, f, p] = await Promise.all([
      (supabase as any).from("sabores").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("funcionarios").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("producoes").select("*, sabores(nome)").order("created_at", { ascending: false }).limit(50),
    ]);
    setSabores(s.data || []);
    setFuncionarios(f.data || []);
    setProducoes(p.data || []);
  }

  function addFunc() {
    setFuncList([...funcList, { funcionario_id: "", quantidade_produzida: 0 }]);
  }

  function removeFunc(i: number) {
    setFuncList(funcList.filter((_, idx) => idx !== i));
  }

  function updateFunc(i: number, field: string, val: any) {
    const list = [...funcList];
    (list[i] as any)[field] = field === "quantidade_produzida" ? Number(val) : val;
    setFuncList(list);
  }

  async function handleSubmit() {
    if (!saborId) return toast({ title: "Selecione um sabor", variant: "destructive" });
    if (funcList.length === 0) return toast({ title: "Adicione funcionários", variant: "destructive" });
    const soma = funcList.reduce((s, f) => s + f.quantidade_produzida, 0);
    if (soma !== qtdTotal) return toast({ title: `Soma dos funcionários (${soma}) ≠ total (${qtdTotal})`, variant: "destructive" });

    const nomesFuncionarios = funcList
      .map(f => funcionarios.find(fn => fn.id === f.funcionario_id)?.nome)
      .filter(Boolean)
      .join(", ");

    setLoading(true);
    try {
      await realizarProducao({
        p_sabor_id: saborId,
        p_modo: modo,
        p_quantidade_lotes: modo === "lote" ? qtdLotes : 0,
        p_quantidade_total: qtdTotal,
        p_operador: nomesFuncionarios || "sistema",
        p_observacoes: observacoes,
        p_funcionarios: funcList,
      });
      toast({ title: "Produção registrada com sucesso!" });
      setOpen(false);
      resetForm();
      loadData();
    } catch (e: any) {
      toast({ title: "Erro na produção", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSaborId("");
    setModo("lote");
    setQtdLotes(1);
    setQtdTotal(84);
    setObservacoes("");
    setFuncList([{ funcionario_id: "", quantidade_produzida: 0 }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produção</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Produção</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Produção</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Sabor</Label>
                <Select value={saborId} onValueChange={setSaborId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modo</Label>
                <Select value={modo} onValueChange={(v) => setModo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lote">Lote (84 un.)</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modo === "lote" ? (
                <div>
                  <Label>Qtd. Lotes</Label>
                  <Input type="number" min={1} value={qtdLotes} onChange={(e) => setQtdLotes(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">Total: {qtdLotes * 84} gelos</p>
                </div>
              ) : (
                <div>
                  <Label>Qtd. Total</Label>
                  <Input type="number" min={1} value={qtdTotal} onChange={(e) => setQtdTotal(Number(e.target.value))} />
                </div>
              )}
              <div>
                <Label>Observações</Label>
                <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Funcionários</Label>
                  <Button size="sm" variant="outline" onClick={addFunc}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {funcList.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Select value={f.funcionario_id} onValueChange={(v) => updateFunc(i, "funcionario_id", v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                      <SelectContent>
                        {funcionarios.map((fn) => <SelectItem key={fn.id} value={fn.id}>{fn.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-24"
                      placeholder="Qtd"
                      value={f.quantidade_produzida || ""}
                      onChange={(e) => updateFunc(i, "quantidade_produzida", e.target.value)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeFunc(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {funcList.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Soma: {funcList.reduce((s, f) => s + f.quantidade_produzida, 0)} / {qtdTotal}
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading ? "Processando..." : "Registrar Produção"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                </TableRow>
              ))}
              {producoes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma produção.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
