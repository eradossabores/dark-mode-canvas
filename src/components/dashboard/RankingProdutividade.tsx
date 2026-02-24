import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

interface FuncRanking {
  nome: string;
  totalProduzido: number;
  producoes: number;
}

export default function RankingProdutividade() {
  const [ranking, setRanking] = useState<FuncRanking[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await (supabase as any)
        .from("producao_funcionarios")
        .select("quantidade_produzida, funcionarios(nome)");

      const map: Record<string, FuncRanking> = {};
      (data || []).forEach((pf: any) => {
        const nome = pf.funcionarios?.nome || "?";
        if (!map[nome]) map[nome] = { nome, totalProduzido: 0, producoes: 0 };
        map[nome].totalProduzido += pf.quantidade_produzida;
        map[nome].producoes += 1;
      });

      setRanking(Object.values(map).sort((a, b) => b.totalProduzido - a.totalProduzido).slice(0, 5));
    } catch (e) {
      console.error("RankingProdutividade error:", e);
    }
  }

  if (ranking.length === 0) return null;

  const maxVal = ranking[0]?.totalProduzido || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Ranking de Produtividade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ranking.map((func, i) => (
            <div key={func.nome} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {i === 0 && <Medal className="h-4 w-4 text-amber-500" />}
                  {i === 1 && <Medal className="h-4 w-4 text-gray-400" />}
                  {i === 2 && <Medal className="h-4 w-4 text-amber-700" />}
                  {i > 2 && <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>}
                  <span className="font-medium truncate">{func.nome}</span>
                </div>
                <span className="text-muted-foreground text-xs shrink-0">{func.totalProduzido.toLocaleString("pt-BR")} un</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${(func.totalProduzido / maxVal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
