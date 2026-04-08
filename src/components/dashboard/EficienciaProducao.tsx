import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

interface Props {
  factoryId: string | null;
}

export default function EficienciaProducao({ factoryId }: Props) {
  const [totalProd, setTotalProd] = useState(0);
  const [totalAvarias, setTotalAvarias] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [prodRes, avariaRes] = await Promise.all([
        (supabase as any).from("producoes").select("quantidade_total").eq("factory_id", factoryId).gte("created_at", inicioMes),
        (supabase as any).from("avarias").select("quantidade").eq("factory_id", factoryId).gte("created_at", inicioMes),
      ]);

      const prod = (prodRes.data || []).reduce((s: number, p: any) => s + p.quantidade_total, 0);
      const avarias = (avariaRes.data || []).reduce((s: number, a: any) => s + a.quantidade, 0);
      setTotalProd(prod);
      setTotalAvarias(avarias);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return null;

  const total = totalProd + totalAvarias;
  const eficiencia = total > 0 ? (totalProd / total) * 100 : 100;
  const color = eficiencia >= 95 ? "text-green-500" : eficiencia >= 85 ? "text-yellow-500" : "text-destructive";
  const strokeColor = eficiencia >= 95 ? "stroke-green-500" : eficiencia >= 85 ? "stroke-yellow-500" : "stroke-destructive";

  // SVG circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (eficiencia / 100) * circumference;

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Eficiência de Produção
          <span className="text-[10px] text-muted-foreground font-normal">(mês atual)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Circular progress */}
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r={radius} fill="none"
                className={strokeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${color}`}>{eficiencia.toFixed(1)}%</span>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Produzido</span>
              <span className="font-medium text-green-500">{totalProd.toLocaleString()} un.</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avarias</span>
              <span className="font-medium text-destructive">{totalAvarias.toLocaleString()} un.</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1">
              <span className="text-muted-foreground">Total bruto</span>
              <span className="font-bold">{total.toLocaleString()} un.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
