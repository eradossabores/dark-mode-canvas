import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Crown } from "lucide-react";

interface Props {
  factoryId: string | null;
}

interface ClienteABC {
  nome: string;
  faturamento: number;
  classe: "A" | "B" | "C";
  percentual: number;
}

export default function ClassificacaoABC({ factoryId }: Props) {
  const [clientes, setClientes] = useState<ClienteABC[]>([]);
  const [resumo, setResumo] = useState({ a: 0, b: 0, c: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: vendas } = await (supabase as any)
        .from("vendas")
        .select("total, cliente_id, clientes(nome)")
        .eq("factory_id", factoryId)
        .neq("status", "cancelada");

      // Aggregate by client
      const map: Record<string, { nome: string; total: number }> = {};
      (vendas || []).forEach((v: any) => {
        const id = v.cliente_id;
        if (!map[id]) map[id] = { nome: v.clientes?.nome || "—", total: 0 };
        map[id].total += Number(v.total);
      });

      const sorted = Object.values(map).sort((a, b) => b.total - a.total);
      const totalGeral = sorted.reduce((s, c) => s + c.total, 0);

      // Classify ABC
      let acumulado = 0;
      const result: ClienteABC[] = sorted.map((c) => {
        acumulado += c.total;
        const pct = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
        let classe: "A" | "B" | "C" = "C";
        if (pct <= 80) classe = "A";
        else if (pct <= 95) classe = "B";
        return { nome: c.nome, faturamento: c.total, classe, percentual: totalGeral > 0 ? (c.total / totalGeral) * 100 : 0 };
      });

      setClientes(result);
      setResumo({
        a: result.filter(c => c.classe === "A").length,
        b: result.filter(c => c.classe === "B").length,
        c: result.filter(c => c.classe === "C").length,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return null;

  const classeColors = { A: "bg-green-500/10 text-green-600 border-green-200", B: "bg-yellow-500/10 text-yellow-600 border-yellow-200", C: "bg-muted text-muted-foreground border-border" };

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Crown className="h-4 w-4 text-yellow-500" />
          Classificação ABC
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary badges */}
        <div className="flex gap-2 mb-3">
          <Badge className="bg-green-500/10 text-green-600 border-green-200">A: {resumo.a} ({((resumo.a / (clientes.length || 1)) * 100).toFixed(0)}%)</Badge>
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">B: {resumo.b}</Badge>
          <Badge variant="secondary">C: {resumo.c}</Badge>
        </div>

        {/* Top clients */}
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {clientes.slice(0, 10).map((c, i) => (
            <div key={i} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border ${classeColors[c.classe]}`}>
                  {c.classe}
                </span>
                <span className="text-xs truncate">{c.nome}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground shrink-0">R$ {c.faturamento.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
