import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  factoryId: string | null;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function ComparativoMensal({ factoryId }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const mesAtual = now.getMonth();
      const anoAtual = now.getFullYear();
      const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

      // Get all vendas for current and previous month
      const inicioAnterior = new Date(anoAnterior, mesAnterior, 1).toISOString();
      const fimAtual = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59).toISOString();

      const { data: vendas } = await (supabase as any)
        .from("vendas")
        .select("total, created_at, status")
        .eq("factory_id", factoryId)
        .gte("created_at", inicioAnterior)
        .lte("created_at", fimAtual)
        .neq("status", "cancelada");

      const { data: producoes } = await (supabase as any)
        .from("producoes")
        .select("quantidade_total, created_at")
        .eq("factory_id", factoryId)
        .gte("created_at", inicioAnterior)
        .lte("created_at", fimAtual);

      // Aggregate by month
      const mesAtualVendas = (vendas || []).filter((v: any) => {
        const d = new Date(v.created_at);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      });
      const mesAnteriorVendas = (vendas || []).filter((v: any) => {
        const d = new Date(v.created_at);
        return d.getMonth() === mesAnterior && d.getFullYear() === anoAnterior;
      });

      const mesAtualProd = (producoes || []).filter((p: any) => {
        const d = new Date(p.created_at);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      });
      const mesAnteriorProd = (producoes || []).filter((p: any) => {
        const d = new Date(p.created_at);
        return d.getMonth() === mesAnterior && d.getFullYear() === anoAnterior;
      });

      const fatAtual = mesAtualVendas.reduce((s: number, v: any) => s + Number(v.total), 0);
      const fatAnterior = mesAnteriorVendas.reduce((s: number, v: any) => s + Number(v.total), 0);
      const prodAtual = mesAtualProd.reduce((s: number, p: any) => s + p.quantidade_total, 0);
      const prodAnterior = mesAnteriorProd.reduce((s: number, p: any) => s + p.quantidade_total, 0);

      setData([
        { metric: "Faturamento", anterior: fatAnterior, atual: fatAtual, labelAnterior: MESES[mesAnterior], labelAtual: MESES[mesAtual] },
        { metric: "Vendas", anterior: mesAnteriorVendas.length, atual: mesAtualVendas.length, labelAnterior: MESES[mesAnterior], labelAtual: MESES[mesAtual] },
        { metric: "Produção", anterior: prodAnterior, atual: prodAtual, labelAnterior: MESES[mesAnterior], labelAtual: MESES[mesAtual] },
      ]);
    } catch (e) {
      console.error("ComparativoMensal error:", e);
    }
    setLoading(false);
  }

  if (loading) return <Card><CardContent className="p-6 text-center text-muted-foreground animate-pulse">Carregando comparativo...</CardContent></Card>;

  const chartData = data.map(d => ({
    name: d.metric,
    [d.labelAnterior]: d.anterior,
    [d.labelAtual]: d.atual,
  }));

  const labels = data[0] ? [data[0].labelAnterior, data[0].labelAtual] : ["Anterior", "Atual"];

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          📊 Comparativo Mensal
          <span className="text-xs text-muted-foreground font-normal">({labels[0]} vs {labels[1]})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {data.map((d, i) => {
            const diff = d.anterior > 0 ? ((d.atual - d.anterior) / d.anterior * 100) : d.atual > 0 ? 100 : 0;
            const isUp = diff > 0;
            const isDown = diff < 0;
            return (
              <div key={i} className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">{d.metric}</p>
                <p className="text-lg font-bold">{d.metric === "Faturamento" ? `R$ ${d.atual.toFixed(0)}` : d.atual}</p>
                <div className={`flex items-center justify-center gap-1 text-xs ${isUp ? "text-green-500" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
                  {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {diff.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={labels[0]} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
            <Bar dataKey={labels[1]} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
