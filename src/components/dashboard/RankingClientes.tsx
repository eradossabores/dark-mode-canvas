import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClienteRanking {
  nome: string;
  totalComprado: number;
  totalGasto: number;
  vendas: number;
}

type Filtro = "total" | "semana" | "mes";

export default function RankingClientes({ factoryId }: { factoryId?: string | null }) {
  const [ranking, setRanking] = useState<ClienteRanking[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("total");

  useEffect(() => { load(); }, [factoryId, filtro]);

  async function load() {
    try {
      let q = (supabase as any)
        .from("vendas")
        .select("total, cliente_id, created_at, clientes(nome), venda_itens(quantidade)");
      if (factoryId) q = q.eq("factory_id", factoryId);

      if (filtro === "semana") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        q = q.gte("created_at", d.toISOString());
      } else if (filtro === "mes") {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        q = q.gte("created_at", d.toISOString());
      }

      const { data } = await q;
      const map: Record<string, ClienteRanking> = {};
      (data || []).forEach((v: any) => {
        const nome = v.clientes?.nome || "?";
        const id = v.cliente_id;
        if (!map[id]) map[id] = { nome, totalComprado: 0, totalGasto: 0, vendas: 0 };
        const qtd = (v.venda_itens || []).reduce((s: number, i: any) => s + (i.quantidade || 0), 0);
        map[id].totalComprado += qtd;
        map[id].totalGasto += v.total || 0;
        map[id].vendas += 1;
      });

      setRanking(Object.values(map).sort((a, b) => b.totalGasto - a.totalGasto).slice(0, 5));
    } catch (e) {
      console.error("RankingClientes error:", e);
    }
  }

  if (ranking.length === 0) return null;

  const maxVal = ranking[0]?.totalGasto || 1;
  const filtros: { value: Filtro; label: string }[] = [
    { value: "total", label: "Total" },
    { value: "semana", label: "Semana" },
    { value: "mes", label: "Mês" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking de Clientes
          </CardTitle>
          <div className="flex gap-1">
            {filtros.map(f => (
              <Badge
                key={f.value}
                variant={filtro === f.value ? "default" : "outline"}
                className="cursor-pointer text-[10px] px-2 py-0.5"
                onClick={() => setFiltro(f.value)}
              >
                {f.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ranking.map((c, i) => (
            <div key={c.nome + i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {i === 0 && <Medal className="h-4 w-4 text-amber-500 shrink-0" />}
                  {i === 1 && <Medal className="h-4 w-4 text-muted-foreground shrink-0" />}
                  {i === 2 && <Medal className="h-4 w-4 text-amber-700 shrink-0" />}
                  {i > 2 && <span className="w-4 text-center text-xs text-muted-foreground shrink-0">{i + 1}</span>}
                  <span className="font-medium truncate">{c.nome}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold">R$ {c.totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({c.totalComprado} un · {c.vendas}x)</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${(c.totalGasto / maxVal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
