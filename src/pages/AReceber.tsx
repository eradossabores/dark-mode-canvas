import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, AlertTriangle } from "lucide-react";

export default function AReceber() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("vendas")
      .select("*, clientes(nome)")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    setVendas(data || []);
    setLoading(false);
  }

  async function marcarComoPaga(id: string) {
    try {
      const { error } = await (supabase as any)
        .from("vendas")
        .update({ status: "paga" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Venda marcada como paga!" });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const hoje = new Date().toISOString().split("T")[0];
  const totalPendente = vendas.reduce((s, v) => s + Number(v.total), 0);
  const vencidas = vendas.filter(v => v.created_at.split("T")[0] < hoje);
  const totalVencido = vencidas.reduce((s, v) => s + Number(v.total), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">A Receber</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">R$ {totalPendente.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vendas.length} venda(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">R$ {totalVencido.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vencidas.length} venda(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em dia</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">R$ {(totalPendente - totalVencido).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vendas.length - vencidas.length} venda(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle>Vendas Pendentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => {
                const isVencida = v.created_at.split("T")[0] < hoje;
                return (
                  <TableRow key={v.id}>
                    <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{v.clientes?.nome}</TableCell>
                    <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{v.forma_pagamento?.replace("_", " ")}</TableCell>
                    <TableCell>{v.numero_nf || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={isVencida ? "destructive" : "secondary"}>
                        {isVencida ? "Vencida" : "Em dia"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => marcarComoPaga(v.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Receber
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vendas.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma venda pendente. 🎉
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
