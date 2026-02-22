import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, Factory, Users, AlertTriangle, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalGelos: 0,
    totalClientes: 0,
    totalVendas: 0,
    totalProducoes: 0,
    faturamento: 0,
    clientesInativos: 0,
  });
  const [topSabores, setTopSabores] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [gelos, clientes, vendas, producoes, inativos] = await Promise.all([
        (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome)"),
        (supabase as any).from("clientes").select("id").eq("status", "ativo"),
        (supabase as any).from("vendas").select("total, created_at"),
        (supabase as any).from("producoes").select("quantidade_total"),
        (supabase as any).from("clientes").select("id").eq("status", "inativo"),
      ]);

      const totalGelos = (gelos.data || []).reduce((s: number, g: any) => s + g.quantidade, 0);
      const faturamento = (vendas.data || []).reduce((s: number, v: any) => s + Number(v.total), 0);

      // Top sabores vendidos
      const { data: topData } = await (supabase as any)
        .from("venda_itens")
        .select("sabor_id, quantidade, sabores(nome)");

      const saborMap: Record<string, { nome: string; total: number }> = {};
      (topData || []).forEach((item: any) => {
        const id = item.sabor_id;
        if (!saborMap[id]) saborMap[id] = { nome: item.sabores?.nome || "?", total: 0 };
        saborMap[id].total += item.quantidade;
      });
      const sorted = Object.values(saborMap).sort((a, b) => b.total - a.total).slice(0, 5);

      setTopSabores(sorted);
      setStats({
        totalGelos,
        totalClientes: clientes.data?.length || 0,
        totalVendas: vendas.data?.length || 0,
        totalProducoes: producoes.data?.length || 0,
        faturamento,
        clientesInativos: inativos.data?.length || 0,
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
    { title: "Clientes Inativos", value: stats.clientesInativos, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 5 Sabores Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {topSabores.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {topSabores.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-medium">{s.nome}</span>
                  <span className="text-muted-foreground">{s.total} un.</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
