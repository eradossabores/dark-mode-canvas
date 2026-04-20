import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, DollarSign, Package, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function HistoricoVendas() {
  const { user, factoryId } = useAuth();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  async function load() {
    if (!user || !factoryId) return;
    setLoading(true);

    // Get vendor's clients
    const { data: vinc } = await (supabase as any)
      .from("cliente_vendedor")
      .select("cliente_id")
      .eq("vendedor_user_id", user.id);
    const clienteIds = (vinc || []).map((v: any) => v.cliente_id);

    if (clienteIds.length === 0) {
      setVendas([]);
      setLoading(false);
      return;
    }

    const { data } = await (supabase as any)
      .from("vendas")
      .select("id, numero_pedido, created_at, total, status, forma_pagamento, observacoes, clientes(nome), venda_itens(quantidade, subtotal, sabores(nome)), abatimentos_historico(valor)")
      .in("cliente_id", clienteIds)
      .eq("factory_id", factoryId)
      .order("created_at", { ascending: false })
      .limit(200);

    setVendas(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user, factoryId]);

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const matchSearch = !search || v.clientes?.nome?.toLowerCase().includes(search.toLowerCase()) || String(v.numero_pedido || "").includes(search);
      const matchStatus = statusFilter === "todos" || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vendas, search, statusFilter]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, v) => s + Number(v.total || 0), 0);
    const unidades = filtered.reduce((s, v) => s + (v.venda_itens || []).reduce((x: number, i: any) => x + Number(i.quantidade || 0), 0), 0);
    return { total, unidades, count: filtered.length };
  }, [filtered]);

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      pago: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
      pendente: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
      parcial: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
      cancelada: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <History className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Histórico de Vendas</h1>
          <p className="text-sm text-muted-foreground">Suas vendas registradas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Total de Pedidos</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totals.count}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Unidades Vendidas</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totals.unidades}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Faturamento</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-primary">R$ {totals.total.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <CardTitle>Vendas</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente ou nº pedido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-full md:w-64" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma venda encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Unid.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Pagto</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const unid = (v.venda_itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
                    const itens = (v.venda_itens || []).map((i: any) => `${i.quantidade}x ${i.sabores?.nome || ""}`).join(", ");
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">#{v.numero_pedido || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{format(new Date(v.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="font-medium">{v.clientes?.nome || "-"}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={itens}>{itens}</TableCell>
                        <TableCell className="text-right">{unid}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {Number(v.total || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs capitalize">{v.forma_pagamento || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className={getStatusBadge(v.status)}>{v.status || "-"}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
