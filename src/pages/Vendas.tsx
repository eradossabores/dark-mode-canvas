import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function Vendas() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [operador, setOperador] = useState("sistema");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<{ sabor_id: string; quantidade: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [c, s, v] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome").eq("status", "ativo").order("nome"),
      (supabase as any).from("sabores").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }).limit(50),
    ]);
    setClientes(c.data || []);
    setSabores(s.data || []);
    setVendas(v.data || []);
  }

  function addItem() { setItens([...itens, { sabor_id: "", quantidade: 1 }]); }
  function removeItem(i: number) { setItens(itens.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, val: any) {
    const list = [...itens];
    (list[i] as any)[field] = field === "quantidade" ? Number(val) : val;
    setItens(list);
  }

  async function handleSubmit() {
    if (!clienteId) return toast({ title: "Selecione um cliente", variant: "destructive" });
    if (itens.length === 0) return toast({ title: "Adicione itens", variant: "destructive" });

    setLoading(true);
    try {
      await realizarVenda({
        p_cliente_id: clienteId,
        p_operador: operador,
        p_observacoes: observacoes,
        p_itens: itens,
      });
      toast({ title: "Venda registrada com sucesso!" });
      setOpen(false);
      setItens([]);
      setClienteId("");
      setObservacoes("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro na venda", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Venda</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operador</Label>
                <Input value={operador} onChange={(e) => setOperador(e.target.value)} />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Itens</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {itens.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Select value={item.sabor_id} onValueChange={(v) => updateItem(i, "sabor_id", v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor" /></SelectTrigger>
                      <SelectContent>
                        {sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-24"
                      placeholder="Qtd"
                      min={1}
                      value={item.quantidade || ""}
                      onChange={(e) => updateItem(i, "quantidade", e.target.value)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading ? "Processando..." : "Registrar Venda"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de Vendas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Operador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{v.clientes?.nome}</TableCell>
                  <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{v.status}</TableCell>
                  <TableCell>{v.operador}</TableCell>
                </TableRow>
              ))}
              {vendas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma venda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
