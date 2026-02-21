import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "parcelado", label: "Parcelado" },
  { value: "fiado", label: "Fiado" },
];

export default function Vendas() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [operador, setOperador] = useState("sistema");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
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

  function getSaborNome(id: string) {
    return sabores.find(s => s.id === id)?.nome || "";
  }

  async function handleSubmit() {
    if (itens.length === 0) return toast({ title: "Adicione ao menos um gelo", variant: "destructive" });
    if (itens.some(i => !i.sabor_id)) return toast({ title: "Selecione o sabor de todos os itens", variant: "destructive" });
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });
    if (!formaPagamento) return toast({ title: "Selecione a forma de pagamento", variant: "destructive" });

    setLoading(true);
    try {
      // Update vendas with forma_pagamento via observacoes or direct column
      await realizarVenda({
        p_cliente_id: clienteId,
        p_operador: operador,
        p_observacoes: observacoes ? `[${formaPagamento}] ${observacoes}` : `[${formaPagamento}]`,
        p_itens: itens,
      });

      // Update forma_pagamento on the created venda
      // We get the latest venda for this client
      const { data: latestVenda } = await (supabase as any)
        .from("vendas")
        .select("id")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (latestVenda?.[0]) {
        await (supabase as any)
          .from("vendas")
          .update({ forma_pagamento: formaPagamento })
          .eq("id", latestVenda[0].id);
      }

      toast({ title: "Venda registrada com sucesso!" });
      setOpen(false);
      setItens([]);
      setClienteId("");
      setFormaPagamento("dinheiro");
      setObservacoes("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro na venda", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function getFormaPagamentoLabel(v: any) {
    if (v.forma_pagamento) {
      return FORMAS_PAGAMENTO.find(f => f.value === v.forma_pagamento)?.label || v.forma_pagamento;
    }
    // Fallback: extract from observacoes
    const match = v.observacoes?.match(/^\[([^\]]+)\]/);
    return match ? match[1] : "-";
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
              {/* 1. ITENS - Principal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Gelos Saborizados
                  </Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {itens.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                    Clique em "Add" para incluir gelos à venda
                  </p>
                )}
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
                      className="w-20"
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

              {/* 2. Para quem vendeu */}
              <div>
                <Label>Cliente (para quem)</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Quem vendeu */}
              <div>
                <Label>Vendedor (quem vendeu)</Label>
                <Input value={operador} onChange={(e) => setOperador(e.target.value)} placeholder="Nome do vendedor" />
              </div>

              {/* 4. Forma de pagamento */}
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Observações */}
              <div>
                <Label>Observações</Label>
                <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
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
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{v.clientes?.nome}</TableCell>
                  <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                  <TableCell>{getFormaPagamentoLabel(v)}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"}>
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{v.operador}</TableCell>
                </TableRow>
              ))}
              {vendas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma venda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
