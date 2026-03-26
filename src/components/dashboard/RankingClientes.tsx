import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

interface ClienteRanking {
  nome: string;
  totalComprado: number;
  totalGasto: number;
  vendas: number;
}

export default function RankingClientes({ factoryId }: { factoryId?: string | null }) {
  const [ranking, setRanking] = useState<ClienteRanking[]>([]);

  useEffect(() => { load(); }, [factoryId]);

  async function load() {
    try {
      let q = (supabase as any)
        .from("vendas")
        .select("total, cliente_id, clientes(nome), venda_itens(quantidade)");
      if (factoryId) q = q.eq("factory_id", factoryId);

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Ranking de Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ranking.map((c, i) => (
            <div key={c.nome + i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {i === 0 && <Medal className="h-4 w-4 text-amber-500" />}
                  {i === 1 && <Medal className="h-4 w-4 text-muted-foreground" />}
                  {i === 2 && <Medal className="h-4 w-4 text-amber-700" />}
                  {i > 2 && <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>}
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
