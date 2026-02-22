import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ShoppingCart, Pencil, Eye } from "lucide-react";

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
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<{ sabor_id: string; quantidade: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Edit state
  const [editVenda, setEditVenda] = useState<any>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editForma, setEditForma] = useState("");
  const [editObs, setEditObs] = useState("");

  // Detail state
  const [detailVenda, setDetailVenda] = useState<any>(null);
  const [detailItens, setDetailItens] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [c, s, v] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome").eq("status", "ativo").order("nome"),
      (supabase as any).from("sabores").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }).limit(100),
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
    if (itens.length === 0) return toast({ title: "Adicione ao menos um gelo", variant: "destructive" });
    if (itens.some(i => !i.sabor_id)) return toast({ title: "Selecione o sabor de todos os itens", variant: "destructive" });
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });

    setLoading(true);
    try {
      await realizarVenda({
        p_cliente_id: clienteId, p_operador: "sistema",
        p_observacoes: observacoes ? `[${formaPagamento}] ${observacoes}` : `[${formaPagamento}]`,
        p_itens: itens,
      });

      const { data: latestVenda } = await (supabase as any)
        .from("vendas").select("id").eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }).limit(1);
      if (latestVenda?.[0]) {
        await (supabase as any).from("vendas").update({ forma_pagamento: formaPagamento }).eq("id", latestVenda[0].id);
      }

      toast({ title: "Venda registrada com sucesso!" });
      setOpen(false); setItens([]); setClienteId(""); setFormaPagamento("dinheiro"); setObservacoes("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro na venda", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openEditDialog(v: any) {
    setEditVenda(v);
    setEditStatus(v.status);
    setEditForma(v.forma_pagamento || "dinheiro");
    setEditObs(v.observacoes || "");
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editVenda) return;
    try {
      const { error } = await (supabase as any).from("vendas").update({
        status: editStatus, forma_pagamento: editForma, observacoes: editObs,
      }).eq("id", editVenda.id);
      if (error) throw error;
      toast({ title: "Venda atualizada!" });
      setEditOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function openDetailDialog(v: any) {
    setDetailVenda(v);
    const { data } = await (supabase as any).from("venda_itens").select("*, sabores(nome)").eq("venda_id", v.id);
    setDetailItens(data || []);
    setDetailOpen(true);
  }

  async function handleCancel() {
    if (!cancelId) return;
    try {
      const { error } = await (supabase as any).from("vendas").update({ status: "cancelada" }).eq("id", cancelId);
      if (error) throw error;
      toast({ title: "Venda cancelada!" });
      setCancelId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function getFormaPagamentoLabel(v: any) {
    if (v.forma_pagamento) return FORMAS_PAGAMENTO.find(f => f.value === v.forma_pagamento)?.label || v.forma_pagamento;
    const match = v.observacoes?.match(/^\[([^\]]+)\]/);
    return match ? match[1] : "-";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Venda</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Gelos</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {itens.length === 0 && <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">Clique em "Add"</p>}
                {itens.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Select value={item.sabor_id} onValueChange={(v) => updateItem(i, "sabor_id", v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor" /></SelectTrigger>
                      <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="w-20" min={1} value={item.quantidade || ""} onChange={(e) => updateItem(i, "quantidade", e.target.value)} />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <div><Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>{loading ? "Processando..." : "Registrar Venda"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Venda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Forma de Pagamento</Label>
              <Select value={editForma} onValueChange={setEditForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Input value={editObs} onChange={(e) => setEditObs(e.target.value)} /></div>
            <Button className="w-full" onClick={handleEditSave}>Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da Venda</DialogTitle></DialogHeader>
          {detailVenda && (
            <div className="space-y-3">
              <p><strong>Cliente:</strong> {detailVenda.clientes?.nome}</p>
              <p><strong>Data:</strong> {new Date(detailVenda.created_at).toLocaleDateString("pt-BR")}</p>
              <p><strong>Total:</strong> R$ {Number(detailVenda.total).toFixed(2)}</p>
              <p><strong>Status:</strong> {detailVenda.status}</p>
              <p><strong>Pagamento:</strong> {getFormaPagamentoLabel(detailVenda)}</p>
              {detailVenda.observacoes && <p><strong>Obs:</strong> {detailVenda.observacoes}</p>}
              <Table>
                <TableHeader><TableRow><TableHead>Sabor</TableHead><TableHead>Qtd</TableHead><TableHead>Preço Un.</TableHead><TableHead>Subtotal</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detailItens.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.sabores?.nome}</TableCell>
                      <TableCell>{it.quantidade}</TableCell>
                      <TableCell>R$ {Number(it.preco_unitario).toFixed(2)}</TableCell>
                      <TableCell>R$ {Number(it.subtotal).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm */}
      <AlertDialog open={!!cancelId} onOpenChange={(v) => !v && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda?</AlertDialogTitle>
            <AlertDialogDescription>A venda será marcada como cancelada. Esta ação não reverte o estoque automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancelar Venda</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{v.clientes?.nome}</TableCell>
                  <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                  <TableCell>{getFormaPagamentoLabel(v)}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openDetailDialog(v)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(v)}><Pencil className="h-4 w-4" /></Button>
                    {v.status !== "cancelada" && (
                      <Button size="icon" variant="ghost" onClick={() => setCancelId(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {vendas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma venda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {vendas.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, vendas.length)} de {vendas.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= vendas.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
