import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, ClipboardList, Eye, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ... keep existing code (statusLabels, statusColors, ItemPedido interface)
const statusLabels: Record<string, string> = {
  aguardando_producao: "Aguardando Produção",
  em_producao: "Em Produção",
  separado_para_entrega: "Separado p/ Entrega",
  enviado: "Enviado",
};

const statusColors: Record<string, string> = {
  aguardando_producao: "bg-amber-500/20 text-amber-700 border-amber-300",
  em_producao: "bg-blue-500/20 text-blue-700 border-blue-300",
  separado_para_entrega: "bg-purple-500/20 text-purple-700 border-purple-300",
  enviado: "bg-green-500/20 text-green-700 border-green-300",
};

interface ItemPedido {
  sabor_id: string;
  sabor_nome: string;
  quantidade: number;
}

export default function PedidosProducao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);

  // Form state
  const [clienteId, setClienteId] = useState("");
  const [tipoEmbalagem, setTipoEmbalagem] = useState("padrão");
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [statusPagamento, setStatusPagamento] = useState("aguardando_pagamento");
  const [saborSel, setSaborSel] = useState("");
  const [qtdSel, setQtdSel] = useState("");

  // Edit form state
  const [editClienteId, setEditClienteId] = useState("");
  const [editTipoEmbalagem, setEditTipoEmbalagem] = useState("");
  const [editDataEntrega, setEditDataEntrega] = useState("");
  const [editHoraEntrega, setEditHoraEntrega] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editItens, setEditItens] = useState<ItemPedido[]>([]);
  const [editStatusPagamento, setEditStatusPagamento] = useState("aguardando_pagamento");
  const [editSaborSel, setEditSaborSel] = useState("");
  const [editQtdSel, setEditQtdSel] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["clientes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: sabores } = useQuery({
    queryKey: ["sabores-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sabores").select("id, nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Query top 5 best-selling flavors
  const { data: topSabores } = useQuery({
    queryKey: ["top-sabores-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_itens")
        .select("sabor_id, quantidade, sabores(nome)");
      if (error) throw error;
      // Aggregate by sabor_id
      const agg: Record<string, { sabor_id: string; nome: string; total: number }> = {};
      for (const item of data || []) {
        const id = item.sabor_id;
        const nome = (item as any).sabores?.nome || "?";
        if (!agg[id]) agg[id] = { sabor_id: id, nome, total: 0 };
        agg[id].total += item.quantidade;
      }
      return Object.values(agg)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos-producao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_producao")
        .select("*, clientes(nome), pedido_producao_itens(*, sabores(nome))")
        .order("data_entrega", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // ... keep existing code (createMutation, resetForm, addItem, removeItem, canSubmit)
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: pedido, error: pedidoErr } = await supabase
        .from("pedidos_producao")
        .insert({
          cliente_id: clienteId,
          tipo_embalagem: tipoEmbalagem,
          data_entrega: `${dataEntrega}T${horaEntrega}`,
          observacoes: observacoes || null,
          status_pagamento: statusPagamento,
        })
        .select()
        .single();
      if (pedidoErr) throw pedidoErr;

      const itensBatch = itens.map((i) => ({
        pedido_id: pedido.id,
        sabor_id: i.sabor_id,
        quantidade: i.quantidade,
      }));
      const { error: itensErr } = await supabase.from("pedido_producao_itens").insert(itensBatch);
      if (itensErr) throw itensErr;

      return pedido;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao"] });
      toast({ title: "Pedido criado!", description: "O pedido foi enviado para produção." });
      resetForm();
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar pedido", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pedido_producao_itens").delete().eq("pedido_id", id);
      const { error } = await supabase.from("pedidos_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao"] });
      toast({ title: "Pedido excluído!" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editOrder) return;
      const { error } = await supabase.from("pedidos_producao").update({
        cliente_id: editClienteId,
        tipo_embalagem: editTipoEmbalagem,
        data_entrega: `${editDataEntrega}T${editHoraEntrega}`,
        observacoes: editObservacoes || null,
        status: editStatus as any,
        status_pagamento: editStatusPagamento,
      }).eq("id", editOrder.id);
      if (error) throw error;

      // Update itens: delete old, insert new
      await supabase.from("pedido_producao_itens").delete().eq("pedido_id", editOrder.id);
      if (editItens.length > 0) {
        const itensBatch = editItens.map((i) => ({
          pedido_id: editOrder.id,
          sabor_id: i.sabor_id,
          quantidade: i.quantidade,
        }));
        const { error: itensErr } = await supabase.from("pedido_producao_itens").insert(itensBatch);
        if (itensErr) throw itensErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao"] });
      toast({ title: "Pedido atualizado!" });
      setEditOpen(false);
      setEditOrder(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setClienteId("");
    setTipoEmbalagem("padrão");
    setDataEntrega("");
    setHoraEntrega("");
    setObservacoes("");
    setStatusPagamento("aguardando_pagamento");
    setItens([]);
  }

  function addItem() {
    if (!saborSel || !qtdSel || Number(qtdSel) <= 0) return;
    const sabor = sabores?.find((s) => s.id === saborSel);
    if (!sabor) return;
    if (itens.some((i) => i.sabor_id === saborSel)) {
      toast({ title: "Sabor já adicionado", variant: "destructive" });
      return;
    }
    setItens([...itens, { sabor_id: saborSel, sabor_nome: sabor.nome, quantidade: Number(qtdSel) }]);
    setSaborSel("");
    setQtdSel("");
  }

  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx));
  }

  function openEdit(p: any) {
    setEditOrder(p);
    setEditClienteId(p.cliente_id);
    setEditTipoEmbalagem(p.tipo_embalagem);
    const dt = new Date(p.data_entrega);
    setEditDataEntrega(format(dt, "yyyy-MM-dd"));
    setEditHoraEntrega(format(dt, "HH:mm"));
    setEditObservacoes(p.observacoes || "");
    setEditStatus(p.status);
    setEditStatusPagamento(p.status_pagamento || "aguardando_pagamento");
    // Load existing items
    setEditItens(
      (p.pedido_producao_itens || []).map((i: any) => ({
        sabor_id: i.sabor_id,
        sabor_nome: i.sabores?.nome || "?",
        quantidade: i.quantidade,
      }))
    );
    setEditSaborSel("");
    setEditQtdSel("");
    setEditOpen(true);
  }

  function addEditItem() {
    if (!editSaborSel || !editQtdSel || Number(editQtdSel) <= 0) return;
    const sabor = sabores?.find((s) => s.id === editSaborSel);
    if (!sabor) return;
    if (editItens.some((i) => i.sabor_id === editSaborSel)) {
      toast({ title: "Sabor já adicionado", variant: "destructive" });
      return;
    }
    setEditItens([...editItens, { sabor_id: editSaborSel, sabor_nome: sabor.nome, quantidade: Number(editQtdSel) }]);
    setEditSaborSel("");
    setEditQtdSel("");
  }

  function removeEditItem(idx: number) {
    setEditItens(editItens.filter((_, i) => i !== idx));
  }

  const canSubmit = clienteId && dataEntrega && horaEntrega && itens.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Pedidos de Produção</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v);
          if (v && itens.length === 0 && topSabores && topSabores.length > 0) {
            setItens(topSabores.map((s) => ({
              sabor_id: s.sabor_id,
              sabor_nome: s.nome,
              quantidade: 0,
            })));
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Pedido de Produção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {clientes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data da Entrega *</Label>
                  <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hora da Entrega *</Label>
                  <Input type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Embalagem</Label>
                  <Select value={tipoEmbalagem} onValueChange={setTipoEmbalagem}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrão">Padrão</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="personalizada">Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status de Pagamento *</Label>
                  <Select value={statusPagamento} onValueChange={setStatusPagamento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Já está pago</SelectItem>
                      <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações importantes..." />
              </div>

              {/* Add items */}
              <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                <Label className="text-base font-semibold">Itens do Pedido</Label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Sabor</Label>
                    <Select value={saborSel} onValueChange={setSaborSel}>
                      <SelectTrigger><SelectValue placeholder="Sabor" /></SelectTrigger>
                      <SelectContent>
                        {sabores?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min="1" value={qtdSel} onChange={(e) => setQtdSel(e.target.value)} placeholder="0" />
                  </div>
                  <Button type="button" size="sm" onClick={addItem} variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {itens.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sabor</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.sabor_nome}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              className="w-20 ml-auto text-right"
                              value={item.quantidade}
                              onChange={(e) => {
                                const newItens = [...itens];
                                newItens[idx] = { ...newItens[idx], quantidade: Number(e.target.value) };
                                setItens(newItens);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar Pedido"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Orders list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Todos os Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !pedidos?.length ? (
            <p className="text-muted-foreground">Nenhum pedido registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Embalagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">
                      {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{p.clientes?.nome}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(p.data_entrega), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{p.tipo_embalagem}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[p.status] || ""}>
                        {statusLabels[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status_pagamento === 'pago' ? 'bg-green-500/20 text-green-700 border-green-300' : 'bg-yellow-500/20 text-yellow-700 border-yellow-300'}>
                        {p.status_pagamento === 'pago' ? 'Pago' : 'Aguardando'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailOrder(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <strong>{detailOrder.clientes?.nome}</strong></div>
                <div><span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant="outline" className={statusColors[detailOrder.status] || ""}>
                    {statusLabels[detailOrder.status]}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Pedido:</span> {format(new Date(detailOrder.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                <div><span className="text-muted-foreground">Entrega:</span> {format(new Date(detailOrder.data_entrega), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                <div><span className="text-muted-foreground">Embalagem:</span> {detailOrder.tipo_embalagem}</div>
                <div><span className="text-muted-foreground">Pagamento:</span>{" "}
                  <Badge variant="outline" className={detailOrder.status_pagamento === 'pago' ? 'bg-green-500/20 text-green-700 border-green-300' : 'bg-yellow-500/20 text-yellow-700 border-yellow-300'}>
                    {detailOrder.status_pagamento === 'pago' ? 'Já está pago' : 'Aguardando pagamento'}
                  </Badge>
                </div>
              </div>
              {detailOrder.observacoes && (
                <div className="text-sm"><span className="text-muted-foreground">Obs:</span> {detailOrder.observacoes}</div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sabor</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailOrder.pedido_producao_itens?.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.sabores?.nome}</TableCell>
                      <TableCell className="text-right">{i.quantidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={editClienteId} onValueChange={setEditClienteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clientes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Entrega</Label>
                <Input type="date" value={editDataEntrega} onChange={(e) => setEditDataEntrega(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora Entrega</Label>
                <Input type="time" value={editHoraEntrega} onChange={(e) => setEditHoraEntrega(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo Embalagem</Label>
                <Select value={editTipoEmbalagem} onValueChange={setEditTipoEmbalagem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrão">Padrão</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="personalizada">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status de Pagamento</Label>
              <Select value={editStatusPagamento} onValueChange={setEditStatusPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Já está pago</SelectItem>
                  <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={editObservacoes} onChange={(e) => setEditObservacoes(e.target.value)} />
            </div>

            {/* Edit items */}
            <div className="border rounded-md p-4 space-y-3 bg-muted/30">
              <Label className="text-base font-semibold">Itens do Pedido</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Sabor</Label>
                  <Select value={editSaborSel} onValueChange={setEditSaborSel}>
                    <SelectTrigger><SelectValue placeholder="Sabor" /></SelectTrigger>
                    <SelectContent>
                      {sabores?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Qtd</Label>
                  <Input type="number" min="1" value={editQtdSel} onChange={(e) => setEditQtdSel(e.target.value)} placeholder="0" />
                </div>
                <Button type="button" size="sm" onClick={addEditItem} variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {editItens.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sabor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editItens.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.sabor_nome}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeEditItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <Button className="w-full" onClick={() => editMutation.mutate()} disabled={editMutation.isPending || editItens.length === 0}>
              {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O pedido e seus itens serão removidos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
