import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface Props {
  factoryId: string | null;
}

export default function RelatorioSazonalidade({ factoryId }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      const anoAtual = new Date().getFullYear();
      const anoAnterior = anoAtual - 1;

      const { data: vendas } = await (supabase as any)
        .from("vendas")
        .select("total, created_at")
        .eq("factory_id", factoryId)
        .neq("status", "cancelada")
        .gte("created_at", `${anoAnterior}-01-01`)
        .order("created_at");

      const mesMap: Record<string, { anoAtual: number; anoAnterior: number }> = {};
      MESES.forEach((m, i) => { mesMap[m] = { anoAtual: 0, anoAnterior: 0 }; });

      (vendas || []).forEach((v: any) => {
        const d = new Date(v.created_at);
        const mes = MESES[d.getMonth()];
        if (d.getFullYear() === anoAtual) mesMap[mes].anoAtual += Number(v.total);
        else if (d.getFullYear() === anoAnterior) mesMap[mes].anoAnterior += Number(v.total);
      });

      setData(MESES.map(m => ({
        mes: m,
        [String(anoAtual)]: mesMap[m].anoAtual,
        [String(anoAnterior)]: mesMap[m].anoAnterior,
      })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="animate-pulse p-4 text-muted-foreground">Carregando sazonalidade...</div>;

  const anoAtual = new Date().getFullYear();
  const anoAnterior = anoAtual - 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Sazonalidade de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" fontSize={10} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={String(anoAnterior)} fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[2, 2, 0, 0]} />
            <Bar dataKey={String(anoAtual)} fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
