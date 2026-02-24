import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ItemPedido {
  sabor_id: string;
  sabor_nome: string;
  quantidade: number;
}

interface EditPedidoDialogProps {
  pedido: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, string> = {
  aguardando_producao: "Aguardando Produção",
  em_producao: "Em Produção",
  separado_para_entrega: "Separado p/ Entrega",
  retirado: "Retirado",
  enviado: "Enviado",
};

export default function EditPedidoDialog({ pedido, open, onOpenChange }: EditPedidoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clienteId, setClienteId] = useState("");
  const [tipoEmbalagem, setTipoEmbalagem] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("");
  const [statusPagamento, setStatusPagamento] = useState("");
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

  useEffect(() => {
    if (pedido && open) {
      setClienteId(pedido.cliente_id);
      setTipoEmbalagem(pedido.tipo_embalagem);
      const dt = new Date(pedido.data_entrega);
      setDataEntrega(format(dt, "yyyy-MM-dd"));
      setHoraEntrega(format(dt, "HH:mm"));
      setObservacoes(pedido.observacoes || "");
      setStatus(pedido.status);
      setStatusPagamento(pedido.status_pagamento || "aguardando_pagamento");
      setItens(
        (pedido.pedido_producao_itens || []).map((i: any) => ({
          sabor_id: i.sabor_id,
          sabor_nome: i.sabores?.nome || "?",
          quantidade: i.quantidade,
        }))
      );
      setSaborSel("");
      setQtdSel("");
    }
  }, [pedido, open]);

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pedidos_producao").update({
        cliente_id: clienteId,
        tipo_embalagem: tipoEmbalagem,
        data_entrega: `${dataEntrega}T${horaEntrega}`,
        observacoes: observacoes || null,
        status: status as any,
        status_pagamento: statusPagamento,
      }).eq("id", pedido.id);
      if (error) throw error;

      await supabase.from("pedido_producao_itens").delete().eq("pedido_id", pedido.id);
      if (itens.length > 0) {
        const batch = itens.map((i) => ({
          pedido_id: pedido.id,
          sabor_id: i.sabor_id,
          quantidade: i.quantidade,
        }));
        const { error: itensErr } = await supabase.from("pedido_producao_itens").insert(batch);
        if (itensErr) throw itensErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao"] });
      toast({ title: "Pedido atualizado!" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

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

  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido</DialogTitle>
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
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
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
                  <SelectItem value="1 sacola">1 Sacola</SelectItem>
                  <SelectItem value="2 sacolas">2 Sacolas</SelectItem>
                  <SelectItem value="sacola com alça">Sacola com Alça</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status de Pagamento</Label>
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
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações..." />
          </div>

          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Itens do Pedido</Label>
              <span className="text-sm font-bold text-primary">Total: {totalItens} un</span>
            </div>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => {
                              const n = [...itens];
                              n[idx] = { ...n[idx], quantidade: Math.max(0, n[idx].quantidade - 1) };
                              setItens(n);
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number" min="0" className="w-16 text-center"
                            value={item.quantidade}
                            onChange={(e) => {
                              const n = [...itens];
                              n[idx] = { ...n[idx], quantidade: Number(e.target.value) };
                              setItens(n);
                            }}
                          />
                          <Button
                            variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => {
                              const n = [...itens];
                              n[idx] = { ...n[idx], quantidade: n[idx].quantidade + 1 };
                              setItens(n);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItens(itens.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Button
            className="w-full"
            disabled={!clienteId || !dataEntrega || !horaEntrega || itens.length === 0 || editMutation.isPending}
            onClick={() => editMutation.mutate()}
          >
            {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
