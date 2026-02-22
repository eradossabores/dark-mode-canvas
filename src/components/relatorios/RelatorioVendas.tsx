import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, Target } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";

const COLORS = ["hsl(200,98%,39%)", "hsl(213,93%,67%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(215,20%,65%)", "hsl(0,72%,50%)"];

export default function RelatorioVendas() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { loadData(); }, []);

  // Reset preview when filters change
  useEffect(() => { setPreviewLoaded(false); }, [startDate, endDate]);

  async function loadData() {
    const [v, it] = await Promise.all([
      (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }),
      (supabase as any).from("venda_itens").select("*, sabores(nome)"),
    ]);
    setVendas(v.data || []);
    setItens(it.data || []);
  }

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const d = new Date(v.created_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
      return true;
    });
  }, [vendas, startDate, endDate]);

  const filteredIds = new Set(filtered.map((v) => v.id));
  const filteredItens = itens.filter((i) => filteredIds.has(i.venda_id));

  const faturamento = filtered.reduce((s, v) => s + Number(v.total), 0);
  const totalVendas = filtered.length;
  const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
  const totalUnidades = filteredItens.reduce((s, i) => s + i.quantidade, 0);

  const porSabor = useMemo(() => {
    const map: Record<string, { qtd: number; valor: number }> = {};
    filteredItens.forEach((i) => {
      const nome = i.sabores?.nome || "?";
      if (!map[nome]) map[nome] = { qtd: 0, valor: 0 };
      map[nome].qtd += i.quantidade;
      map[nome].valor += Number(i.subtotal);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, qtd: v.qtd, valor: v.valor }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [filteredItens]);

  const faturamentoPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((v) => {
      const day = new Date(v.created_at).toLocaleDateString("pt-BR");
      map[day] = (map[day] || 0) + Number(v.total);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).reverse();
  }, [filtered]);

  const headers = ["Data", "Cliente", "Total", "Pagamento", "Status", "Operador"];
  const rows = filtered.map((v) => [
    new Date(v.created_at).toLocaleDateString("pt-BR"),
    v.clientes?.nome || "-",
    `R$ ${Number(v.total).toFixed(2)}`,
    v.forma_pagamento || "-",
    v.status,
    v.operador,
  ]);

  const periodoLabel = `${startDate?.toLocaleDateString("pt-BR") || "—"} a ${endDate?.toLocaleDateString("pt-BR") || "—"}`;

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <ExportButtons
          onPreview={() => setPreviewLoaded(true)}
          previewLoaded={previewLoaded}
          onPDF={() => exportToPDF("Relatório de Vendas", headers, rows, "relatorio-vendas")}
          onExcel={() => exportToExcel(headers, rows, "Vendas", "relatorio-vendas")}
        />
      </DateRangeFilter>

      {!previewLoaded ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Selecione os filtros e clique em "Visualizar Relatório"</p>
            <p className="text-sm mt-1">A pré-visualização será exibida aqui.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">Não há vendas no período de {periodoLabel}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground font-medium">Período: {periodoLabel}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Faturamento" value={`R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
            <KpiCard title="Total de Vendas" value={totalVendas.toString()} icon={ShoppingCart} />
            <KpiCard title="Ticket Médio" value={`R$ ${ticketMedio.toFixed(2)}`} icon={Target} />
            <KpiCard title="Unidades Vendidas" value={totalUnidades.toLocaleString("pt-BR")} icon={TrendingUp} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Ranking - Mais Vendidos</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={porSabor.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Qtd Vendida" fill="hsl(200,98%,39%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Faturamento por Sabor</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={porSabor.slice(0, 6)} dataKey="valor" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {porSabor.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Faturamento por Dia</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={faturamentoPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Line type="monotone" dataKey="value" name="Faturamento" stroke="hsl(200,98%,39%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de Vendas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{v.clientes?.nome}</TableCell>
                      <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                      <TableCell>{v.forma_pagamento || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"}>{v.status}</Badge>
                      </TableCell>
                      <TableCell>{v.operador}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
