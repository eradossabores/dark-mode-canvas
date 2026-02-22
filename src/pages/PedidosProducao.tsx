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
import { Plus, Trash2, ClipboardList, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  // Form state
  const [clienteId, setClienteId] = useState("");
  const [tipoEmbalagem, setTipoEmbalagem] = useState("padrão");
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [saborSel, setSaborSel] = useState("");
  const [qtdSel, setQtdSel] = useState("");

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: pedido, error: pedidoErr } = await supabase
        .from("pedidos_producao")
        .insert({
          cliente_id: clienteId,
          tipo_embalagem: tipoEmbalagem,
          data_entrega: `${dataEntrega}T${horaEntrega}`,
          observacoes: observacoes || null,
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

  function resetForm() {
    setClienteId("");
    setTipoEmbalagem("padrão");
    setDataEntrega("");
    setHoraEntrega("");
    setObservacoes("");
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

  const canSubmit = clienteId && dataEntrega && horaEntrega && itens.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Pedidos de Produção</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
                          <TableCell className="text-right">{item.quantidade}</TableCell>
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
                  <TableHead className="w-10" />
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
                      <Button variant="ghost" size="icon" onClick={() => setDetailOrder(p)}>
                        <Eye className="h-4 w-4" />
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
    </div>
  );
}
