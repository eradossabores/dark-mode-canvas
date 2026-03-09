import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle, DollarSign, Clock, Users } from "lucide-react";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";

const COLORS = ["hsl(0,72%,50%)", "hsl(38,92%,50%)", "hsl(200,98%,39%)", "hsl(142,71%,45%)"];

export default function RelatorioInadimplencia() {
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [p, v] = await Promise.all([
      (supabase as any).from("venda_parcelas").select("*, vendas(cliente_id, clientes(nome))").eq("paga", false).order("vencimento"),
      (supabase as any).from("vendas").select("*, clientes(nome)").eq("status", "pendente"),
    ]);
    setParcelas(p.data || []);
    setVendas(v.data || []);
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const parcelasVencidas = parcelas.filter(p => new Date(p.vencimento) < hoje);
  const parcelasAVencer = parcelas.filter(p => new Date(p.vencimento) >= hoje);

  const totalVencido = parcelasVencidas.reduce((s, p) => s + Number(p.valor), 0);
  const totalAVencer = parcelasAVencer.reduce((s, p) => s + Number(p.valor), 0);
  const totalPendente = vendas.reduce((s, v) => s + Number(v.total), 0);

  // Clientes com mais débitos
  const clienteDebitos = useMemo(() => {
    const map: Record<string, { nome: string; total: number; parcelas: number }> = {};
    parcelasVencidas.forEach(p => {
      const nome = p.vendas?.clientes?.nome || "Desconhecido";
      if (!map[nome]) map[nome] = { nome, total: 0, parcelas: 0 };
      map[nome].total += Number(p.valor);
      map[nome].parcelas += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [parcelasVencidas]);

  // Aging buckets
  const aging = useMemo(() => {
    const buckets = [
      { name: "1-7 dias", min: 1, max: 7, valor: 0 },
      { name: "8-15 dias", min: 8, max: 15, valor: 0 },
      { name: "16-30 dias", min: 16, max: 30, valor: 0 },
      { name: "31+ dias", min: 31, max: 9999, valor: 0 },
    ];
    parcelasVencidas.forEach(p => {
      const dias = Math.floor((hoje.getTime() - new Date(p.vencimento).getTime()) / 86400000);
      const bucket = buckets.find(b => dias >= b.min && dias <= b.max);
      if (bucket) bucket.valor += Number(p.valor);
    });
    return buckets.filter(b => b.valor > 0);
  }, [parcelasVencidas]);

  const headers = ["Cliente", "Vencimento", "Valor", "Dias Atraso"];
  const rows = parcelasVencidas.map(p => [
    p.vendas?.clientes?.nome || "-",
    new Date(p.vencimento).toLocaleDateString("pt-BR"),
    `R$ ${Number(p.valor).toFixed(2)}`,
    Math.floor((hoje.getTime() - new Date(p.vencimento).getTime()) / 86400000).toString(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ExportButtons
          onPreview={() => setPreviewLoaded(true)}
          previewLoaded={previewLoaded}
          onPDF={() => exportToPDF("Relatório de Inadimplência", headers, rows, "relatorio-inadimplencia", [
            { label: "Total Vencido", value: `R$ ${totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "A Vencer", value: `R$ ${totalAVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Parcelas Vencidas", value: parcelasVencidas.length.toString() },
            { label: "Clientes Devedores", value: clienteDebitos.length.toString() },
          ])}
          onExcel={() => exportToExcel(headers, rows, "Inadimplência", "relatorio-inadimplencia")}
        />
      </div>

      {!previewLoaded ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Clique em "Visualizar Relatório" para carregar</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Vencido" value={`R$ ${totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={AlertTriangle} />
            <KpiCard title="A Vencer" value={`R$ ${totalAVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Clock} />
            <KpiCard title="Parcelas Vencidas" value={parcelasVencidas.length.toString()} icon={DollarSign} />
            <KpiCard title="Clientes Devedores" value={clienteDebitos.length.toString()} icon={Users} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Aging - Tempo de Atraso</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={aging} dataKey="valor" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {aging.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Top Devedores</CardTitle></CardHeader>
              <CardContent>
                {clienteDebitos.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Nenhuma inadimplência 🎉</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={clienteDebitos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `R$${v}`} />
                      <YAxis dataKey="nome" type="category" width={100} fontSize={11} />
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                      <Bar dataKey="total" name="Débito" fill="hsl(0,72%,50%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Parcelas Vencidas</CardTitle></CardHeader>
            <CardContent>
              {parcelasVencidas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma parcela vencida!</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>{headers.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasVencidas.slice(0, 50).map(p => {
                      const dias = Math.floor((hoje.getTime() - new Date(p.vencimento).getTime()) / 86400000);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>{p.vendas?.clientes?.nome || "-"}</TableCell>
                          <TableCell>{new Date(p.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>R$ {Number(p.valor).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={dias > 30 ? "destructive" : dias > 15 ? "secondary" : "outline"}>
                              {dias}d
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
