import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, Factory, Users, AlertTriangle, TrendingUp, DollarSign, Bell } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = [
  "hsl(270, 60%, 50%)",
  "hsl(174, 50%, 45%)",
  "hsl(38, 90%, 55%)",
  "hsl(270, 40%, 65%)",
  "hsl(174, 35%, 60%)",
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalGelos: 0, totalClientes: 0, totalVendas: 0,
    totalProducoes: 0, faturamento: 0, clientesInativos: 0,
  });
  const [topSabores, setTopSabores] = useState<any[]>([]);
  const [vendasPorDia, setVendasPorDia] = useState<any[]>([]);
  const [producaoPorDia, setProducaoPorDia] = useState<any[]>([]);
  const [alertasEstoque, setAlertasEstoque] = useState<any[]>([]);
  const [contasReceber, setContasReceber] = useState({ total: 0, vencidas: 0, quantidade: 0 });

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const [gelos, clientes, vendas, producoes, inativos] = await Promise.all([
        (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome)"),
        (supabase as any).from("clientes").select("id").eq("status", "ativo"),
        (supabase as any).from("vendas").select("total, created_at, status"),
        (supabase as any).from("producoes").select("quantidade_total, created_at"),
        (supabase as any).from("clientes").select("id").eq("status", "inativo"),
      ]);

      const totalGelos = (gelos.data || []).reduce((s: number, g: any) => s + g.quantidade, 0);
      const faturamento = (vendas.data || []).filter((v: any) => v.status !== "cancelada")
        .reduce((s: number, v: any) => s + Number(v.total), 0);

      // Top sabores vendidos
      const { data: topData } = await (supabase as any)
        .from("venda_itens").select("sabor_id, quantidade, sabores(nome)");
      const saborMap: Record<string, { nome: string; total: number }> = {};
      (topData || []).forEach((item: any) => {
        const id = item.sabor_id;
        if (!saborMap[id]) saborMap[id] = { nome: item.sabores?.nome || "?", total: 0 };
        saborMap[id].total += item.quantidade;
      });
      setTopSabores(Object.values(saborMap).sort((a, b) => b.total - a.total).slice(0, 5));

      // Vendas por dia (últimos 7 dias)
      const last7 = new Date(); last7.setDate(last7.getDate() - 6);
      const vendasRecentes = (vendas.data || []).filter((v: any) => new Date(v.created_at) >= last7 && v.status !== "cancelada");
      const vendasDia: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        vendasDia[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
      }
      vendasRecentes.forEach((v: any) => {
        const key = new Date(v.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (vendasDia[key] !== undefined) vendasDia[key] += Number(v.total);
      });
      setVendasPorDia(Object.entries(vendasDia).map(([dia, valor]) => ({ dia, valor })));

      // Produção por dia (últimos 7 dias)
      const prodRecentes = (producoes.data || []).filter((p: any) => new Date(p.created_at) >= last7);
      const prodDia: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        prodDia[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
      }
      prodRecentes.forEach((p: any) => {
        const key = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (prodDia[key] !== undefined) prodDia[key] += p.quantidade_total;
      });
      setProducaoPorDia(Object.entries(prodDia).map(([dia, total]) => ({ dia, total })));

      // Alertas de estoque baixo
      const [mpRes, embRes] = await Promise.all([
        (supabase as any).from("materias_primas").select("nome, estoque_atual, estoque_minimo"),
        (supabase as any).from("embalagens").select("nome, estoque_atual, estoque_minimo"),
      ]);
      const alertas: any[] = [];
      (mpRes.data || []).forEach((m: any) => {
        if (m.estoque_atual <= m.estoque_minimo) alertas.push({ nome: m.nome, tipo: "Matéria-prima", atual: m.estoque_atual, minimo: m.estoque_minimo });
      });
      (embRes.data || []).forEach((e: any) => {
        if (e.estoque_atual <= e.estoque_minimo) alertas.push({ nome: e.nome, tipo: "Embalagem", atual: e.estoque_atual, minimo: e.estoque_minimo });
      });
      (gelos.data || []).filter((g: any) => g.quantidade <= 0).forEach((g: any) => {
        alertas.push({ nome: g.sabores?.nome || "?", tipo: "Gelo", atual: g.quantidade, minimo: 0 });
      });
      setAlertasEstoque(alertas);

      // Contas a receber (vendas pendentes)
      const pendentes = (vendas.data || []).filter((v: any) => v.status === "pendente");
      const hoje = new Date().toISOString().split("T")[0];
      setContasReceber({
        total: pendentes.reduce((s: number, v: any) => s + Number(v.total), 0),
        vencidas: pendentes.filter((v: any) => v.created_at.split("T")[0] < hoje).length,
        quantidade: pendentes.length,
      });

      setStats({
        totalGelos, totalClientes: clientes.data?.length || 0,
        totalVendas: vendas.data?.length || 0, totalProducoes: producoes.data?.length || 0,
        faturamento, clientesInativos: inativos.data?.length || 0,
      });
    } catch (e) {
      console.error("Dashboard error:", e);
    }
  }

  const cards = [
    { title: "Gelos em Estoque", value: stats.totalGelos.toLocaleString(), icon: Package, color: "text-primary" },
    { title: "Clientes Ativos", value: stats.totalClientes, icon: Users, color: "text-secondary-foreground" },
    { title: "Total Vendas", value: stats.totalVendas, icon: ShoppingCart, color: "text-accent" },
    { title: "Faturamento", value: `R$ ${stats.faturamento.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
    { title: "Produções", value: stats.totalProducoes, icon: Factory, color: "text-secondary-foreground" },
    { title: "A Receber", value: `R$ ${contasReceber.total.toFixed(2)}`, icon: DollarSign, color: contasReceber.vencidas > 0 ? "text-destructive" : "text-primary" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Alertas de estoque baixo */}
      {alertasEstoque.length > 0 && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Bell className="h-4 w-4" />
              Alertas de Estoque Baixo ({alertasEstoque.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alertasEstoque.map((a, i) => (
                <Badge key={i} variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {a.tipo}: {a.nome} ({a.atual}/{a.minimo})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Vendas últimos 7 dias */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Faturamento - Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={vendasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Produção últimos 7 dias */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Produção - Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={producaoPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => [`${v} un.`, "Produção"]} />
                <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Sabores - Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 5 Sabores Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topSabores.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma venda registrada ainda.</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={topSabores} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={false}>
                      {topSabores.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [`${v} un.`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {topSabores.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i] }} />
                      <span className="font-medium truncate">{s.nome}</span>
                      <span className="text-muted-foreground ml-auto">{s.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contas a Receber */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Contas a Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Total pendente</span>
                <span className="text-xl font-bold">R$ {contasReceber.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Vendas pendentes</span>
                <Badge variant="secondary">{contasReceber.quantidade}</Badge>
              </div>
              {contasReceber.vencidas > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-destructive text-sm font-medium">Vencidas</span>
                  <Badge variant="destructive">{contasReceber.vencidas}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
