import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";

interface EstoqueItem {
  nome: string;
  atual: number;
  mediaDiaria: number;
  diasRestantes: number | null;
}

export default function EstoqueInteligente() {
  const [items, setItems] = useState<EstoqueItem[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [gelosRes, vendasRes] = await Promise.all([
        (supabase as any).from("estoque_gelos").select("quantidade, sabores(nome, id)"),
        (supabase as any).from("venda_itens").select("sabor_id, quantidade, vendas!inner(created_at, status)"),
      ]);

      const gelos = gelosRes.data || [];
      const vendaItens = (vendasRes.data || []).filter((v: any) => v.vendas?.status !== "cancelada");

      // Calculate 7-day average consumption per sabor
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const consumoMap: Record<string, number> = {};
      vendaItens.forEach((item: any) => {
        if (new Date(item.vendas?.created_at) >= seteDiasAtras) {
          consumoMap[item.sabor_id] = (consumoMap[item.sabor_id] || 0) + item.quantidade;
        }
      });

      const result: EstoqueItem[] = gelos.map((g: any) => {
        const consumo7d = consumoMap[g.sabores?.id] || 0;
        const mediaDiaria = consumo7d / 7;
        const diasRestantes = mediaDiaria > 0 ? Math.floor(g.quantidade / mediaDiaria) : null;

        return {
          nome: g.sabores?.nome || "?",
          atual: g.quantidade,
          mediaDiaria: Math.round(mediaDiaria * 10) / 10,
          diasRestantes,
        };
      });

      // Sort: most critical first (fewest days remaining)
      result.sort((a, b) => {
        if (a.diasRestantes === null && b.diasRestantes === null) return a.atual - b.atual;
        if (a.diasRestantes === null) return 1;
        if (b.diasRestantes === null) return -1;
        return a.diasRestantes - b.diasRestantes;
      });

      setItems(result);
    } catch (e) {
      console.error("EstoqueInteligente error:", e);
    }
  }

  const criticos = items.filter(i => i.diasRestantes !== null && i.diasRestantes <= 3);
  const alerta = items.filter(i => i.diasRestantes !== null && i.diasRestantes > 3 && i.diasRestantes <= 7);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Previsão de Estoque (dias restantes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.filter(i => i.atual > 0).slice(0, 8).map((item) => (
            <div key={item.nome} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {item.diasRestantes !== null && item.diasRestantes <= 3 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                {item.diasRestantes !== null && item.diasRestantes > 3 && item.diasRestantes <= 7 && (
                  <TrendingDown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className="truncate font-medium">{item.nome}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground text-xs">{item.atual} un</span>
                {item.diasRestantes !== null ? (
                  <Badge variant={item.diasRestantes <= 3 ? "destructive" : item.diasRestantes <= 7 ? "secondary" : "outline"}>
                    {item.diasRestantes}d
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">s/ vendas</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
        {(criticos.length > 0 || alerta.length > 0) && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            {criticos.length > 0 && <span className="text-destructive font-medium">{criticos.length} crítico(s)</span>}
            {criticos.length > 0 && alerta.length > 0 && " · "}
            {alerta.length > 0 && <span className="text-amber-500 font-medium">{alerta.length} em alerta</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
