import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, DollarSign, ShoppingCart } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Venda = { id: string; total: number; created_at: string };

export default function Faturamento() {
  const { factoryId } = useAuth();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [mesFiltro, setMesFiltro] = useState<number | "todos">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Faturamento | Painel";
    if (!factoryId) return;
    (async () => {
      setLoading(true);
      const ano = new Date().getFullYear();
      const { data } = await supabase
        .from("vendas")
        .select("id,total,created_at")
        .eq("factory_id", factoryId)
        .gte("created_at", `${ano}-01-01`)
        .order("created_at", { ascending: true });
      setVendas((data as Venda[]) || []);
      setLoading(false);
    })();
  }, [factoryId]);

  const filtradas = useMemo(() => {
    if (mesFiltro === "todos") return vendas;
    return vendas.filter((v) => new Date(v.created_at).getMonth() === mesFiltro);
  }, [vendas, mesFiltro]);

  const totalGeral = filtradas.reduce((s, v) => s + Number(v.total || 0), 0);
  const ticketMedio = filtradas.length ? totalGeral / filtradas.length : 0;

  const porMes = useMemo(() => {
    const acc = Array.from({ length: 12 }, (_, i) => ({ mes: MESES[i], total: 0 }));
    vendas.forEach((v) => {
      const m = new Date(v.created_at).getMonth();
      acc[m].total += Number(v.total || 0);
    });
    return acc.slice(0, new Date().getMonth() + 1);
  }, [vendas]);

  const mesAtual = new Date().getMonth();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Faturamento</h1>
          <p className="text-sm text-muted-foreground">Análise de receita por período</p>
        </div>
      </div>

      {/* Filtro por mês */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMesFiltro("todos")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
            mesFiltro === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
          }`}
        >
          Ano Todo
        </button>
        {MESES.slice(0, mesAtual + 1).map((nome, idx) => (
          <button
            key={nome}
            onClick={() => setMesFiltro(idx)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
              mesFiltro === idx ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            {nome}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {totalGeral.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filtradas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Ticket Médio</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {ticketMedio.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução Mensal · {new Date().getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
    </div>
  );
}