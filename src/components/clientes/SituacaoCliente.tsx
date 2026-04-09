import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Package, DollarSign, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  clienteId: string | null;
  clienteNome: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface VendaPendente {
  id: string;
  created_at: string;
  total: number;
  valor_pago: number;
  forma_pagamento: string;
  status: string;
}

interface PedidoPendente {
  id: string;
  created_at: string;
  data_entrega: string;
  status: string;
  status_pagamento: string;
}

export default function SituacaoCliente({ clienteId, clienteNome, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<VendaPendente[]>([]);
  const [pedidos, setPedidos] = useState<PedidoPendente[]>([]);
  const [abatimentos, setAbatimentos] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && clienteId) load();
  }, [open, clienteId]);

  async function load() {
    if (!clienteId) return;
    setLoading(true);
    try {
      // Vendas pendentes (não pagas)
      const { data: vendasData } = await (supabase as any)
        .from("vendas")
        .select("id, created_at, total, valor_pago, forma_pagamento, status")
        .eq("cliente_id", clienteId)
        .in("status", ["pendente", "a_prazo"])
        .order("created_at", { ascending: false });

      const vendasList = vendasData || [];
      setVendas(vendasList);

      // Buscar abatimentos das vendas pendentes
      if (vendasList.length > 0) {
        const vendaIds = vendasList.map((v: any) => v.id);
        const { data: abData } = await (supabase as any)
          .from("abatimentos_historico")
          .select("venda_id, valor")
          .in("venda_id", vendaIds);

        const abMap: Record<string, number> = {};
        (abData || []).forEach((a: any) => {
          abMap[a.venda_id] = (abMap[a.venda_id] || 0) + a.valor;
        });
        setAbatimentos(abMap);
      } else {
        setAbatimentos({});
      }

      // Pedidos em aberto
      const { data: pedidosData } = await (supabase as any)
        .from("pedidos_producao")
        .select("id, created_at, data_entrega, status, status_pagamento")
        .eq("cliente_id", clienteId)
        .not("status", "eq", "finalizado")
        .order("data_entrega", { ascending: true });

      setPedidos(pedidosData || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const totalPendente = vendas.reduce((acc, v) => {
    const pago = (v.valor_pago || 0) + (abatimentos[v.id] || 0);
    return acc + Math.max(0, v.total - pago);
  }, 0);

  const temPendencias = vendas.length > 0 || pedidos.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Situação — {clienteNome}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className={`flex items-center gap-3 rounded-lg border p-3 ${temPendencias ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-green-300 bg-green-50 dark:bg-green-950/20"}`}>
              {temPendencias ? (
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {temPendencias ? "Possui pendências" : "Tudo em dia!"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vendas.length} venda(s) pendente(s) · {pedidos.length} pedido(s) em aberto
                </p>
              </div>
              {totalPendente > 0 && (
                <Badge variant="destructive" className="ml-auto text-sm">
                  R$ {totalPendente.toFixed(2)}
                </Badge>
              )}
            </div>

            {/* Vendas Pendentes */}
            {vendas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-amber-500" /> Vendas Pendentes
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Total</TableHead>
                        <TableHead className="text-xs">Pago</TableHead>
                        <TableHead className="text-xs">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendas.map(v => {
                        const pago = (v.valor_pago || 0) + (abatimentos[v.id] || 0);
                        const saldo = Math.max(0, v.total - pago);
                        return (
                          <TableRow key={v.id}>
                            <TableCell className="text-xs">{format(new Date(v.created_at), "dd/MM/yy")}</TableCell>
                            <TableCell className="text-xs">R$ {v.total.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-green-600">R$ {pago.toFixed(2)}</TableCell>
                            <TableCell className="text-xs font-semibold text-destructive">R$ {saldo.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Pedidos em aberto */}
            {pedidos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-blue-500" /> Pedidos em Aberto
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Entrega</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Pagamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidos.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{format(new Date(p.data_entrega), "dd/MM/yy")}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{p.status}</Badge></TableCell>
                          <TableCell><Badge variant={p.status_pagamento === "pago" ? "default" : "secondary"} className="text-[10px]">{p.status_pagamento}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {!temPendencias && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhuma pendência financeira ou de pedidos. ✅
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
