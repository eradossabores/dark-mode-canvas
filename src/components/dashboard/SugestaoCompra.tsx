import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart } from "lucide-react";

interface Props {
  factoryId: string | null;
}

interface Sugestao {
  nome: string;
  tipo: string;
  estoque: number;
  consumoMedio30d: number;
  diasCobertura: number;
  sugestaoCompra: number;
}

export default function SugestaoCompra({ factoryId }: Props) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      // Get materias_primas
      const { data: mp } = await (supabase as any)
        .from("materias_primas")
        .select("id, nome, estoque_atual, estoque_minimo")
        .eq("factory_id", factoryId);

      // Get movements in the last 30 days
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() - 30);

      const { data: movimentos } = await (supabase as any)
        .from("movimentacoes_estoque")
        .select("item_id, quantidade, tipo_movimentacao")
        .eq("factory_id", factoryId)
        .eq("tipo_item", "materia_prima")
        .eq("tipo_movimentacao", "saida")
        .gte("created_at", trintaDias.toISOString());

      // Calculate consumption per item
      const consumoMap: Record<string, number> = {};
      (movimentos || []).forEach((m: any) => {
        consumoMap[m.item_id] = (consumoMap[m.item_id] || 0) + Number(m.quantidade);
      });

      const result: Sugestao[] = [];
      (mp || []).forEach((item: any) => {
        const consumo30d = consumoMap[item.id] || 0;
        const consumoDiario = consumo30d / 30;
        const diasCobertura = consumoDiario > 0 ? Math.floor(item.estoque_atual / consumoDiario) : 999;

        if (diasCobertura <= 15 || item.estoque_atual <= item.estoque_minimo) {
          const sugestao = Math.max(0, Math.ceil(consumoDiario * 30 - item.estoque_atual));
          result.push({
            nome: item.nome,
            tipo: "Matéria-prima",
            estoque: item.estoque_atual,
            consumoMedio30d: consumo30d,
            diasCobertura,
            sugestaoCompra: sugestao,
          });
        }
      });

      // Also check embalagens
      const { data: emb } = await (supabase as any)
        .from("embalagens")
        .select("id, nome, estoque_atual, estoque_minimo")
        .eq("factory_id", factoryId);

      (emb || []).forEach((item: any) => {
        if (item.estoque_atual <= item.estoque_minimo * 1.5) {
          result.push({
            nome: item.nome,
            tipo: "Embalagem",
            estoque: item.estoque_atual,
            consumoMedio30d: 0,
            diasCobertura: 0,
            sugestaoCompra: Math.max(0, item.estoque_minimo * 3 - item.estoque_atual),
          });
        }
      });

      result.sort((a, b) => a.diasCobertura - b.diasCobertura);
      setSugestoes(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading || sugestoes.length === 0) return null;

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Sugestão de Compra
          <Badge variant="secondary" className="text-[10px]">{sugestoes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {sugestoes.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{s.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  Estoque: {s.estoque} · {s.diasCobertura > 0 ? `${s.diasCobertura}d cobertura` : "Baixo"}
                </p>
              </div>
              <Badge variant={s.diasCobertura <= 5 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                Comprar {s.sugestaoCompra}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
