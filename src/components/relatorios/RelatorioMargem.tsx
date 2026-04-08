import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

interface Props {
  factoryId: string | null;
}

interface MargemSabor {
  nome: string;
  custoMedio: number;
  precoMedio: number;
  margem: number;
  margemPct: number;
}

export default function RelatorioMargem({ factoryId }: Props) {
  const [data, setData] = useState<MargemSabor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      // Get recipes for cost calculation
      const { data: receitas } = await (supabase as any)
        .from("sabor_receita")
        .select("sabor_id, quantidade_insumo_por_lote, gelos_por_lote, materia_prima_id, embalagem_id, embalagens_por_lote, sabores(nome)")
        .eq("factory_id", factoryId);

      // Get recent purchases for cost per unit
      const { data: compras } = await (supabase as any)
        .from("compras")
        .select("item_id, custo_unitario_com_frete, tipo")
        .eq("factory_id", factoryId)
        .order("created_at", { ascending: false });

      // Get sales prices
      const { data: vendaItens } = await (supabase as any)
        .from("venda_itens")
        .select("sabor_id, preco_unitario, quantidade")
        .eq("factory_id", factoryId);

      // Build cost map (latest cost per item)
      const custoMap: Record<string, number> = {};
      (compras || []).forEach((c: any) => {
        if (c.item_id && !custoMap[c.item_id]) custoMap[c.item_id] = Number(c.custo_unitario_com_frete);
      });

      // Calculate cost per unit (gelo) per sabor
      const saborCusto: Record<string, { nome: string; custo: number }> = {};
      (receitas || []).forEach((r: any) => {
        const custoInsumo = (custoMap[r.materia_prima_id] || 0) * r.quantidade_insumo_por_lote;
        const custoEmb = (custoMap[r.embalagem_id] || 0) * r.embalagens_por_lote;
        const custoLote = custoInsumo + custoEmb;
        const custoPorUnidade = r.gelos_por_lote > 0 ? custoLote / r.gelos_por_lote : 0;
        saborCusto[r.sabor_id] = { nome: r.sabores?.nome || "?", custo: custoPorUnidade };
      });

      // Calculate average selling price per sabor
      const precoMap: Record<string, { total: number; qtd: number }> = {};
      (vendaItens || []).forEach((vi: any) => {
        if (!precoMap[vi.sabor_id]) precoMap[vi.sabor_id] = { total: 0, qtd: 0 };
        precoMap[vi.sabor_id].total += Number(vi.preco_unitario) * vi.quantidade;
        precoMap[vi.sabor_id].qtd += vi.quantidade;
      });

      const result: MargemSabor[] = [];
      Object.entries(saborCusto).forEach(([saborId, { nome, custo }]) => {
        const preco = precoMap[saborId] ? precoMap[saborId].total / precoMap[saborId].qtd : 0;
        const margem = preco - custo;
        const margemPct = preco > 0 ? (margem / preco) * 100 : 0;
        result.push({ nome, custoMedio: custo, precoMedio: preco, margem, margemPct });
      });

      result.sort((a, b) => b.margemPct - a.margemPct);
      setData(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="animate-pulse p-4 text-muted-foreground">Carregando margens...</div>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Margem de Lucro por Sabor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Configure receitas e registre compras para ver as margens.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Sabor</TableHead>
                  <TableHead className="text-xs text-right">Custo</TableHead>
                  <TableHead className="text-xs text-right">Preço Médio</TableHead>
                  <TableHead className="text-xs text-right">Margem</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{d.nome}</TableCell>
                    <TableCell className="text-xs text-right">R$ {d.custoMedio.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-right">R$ {d.precoMedio.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">R$ {d.margem.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <Badge variant={d.margemPct >= 50 ? "default" : d.margemPct >= 30 ? "secondary" : "destructive"} className="text-[10px]">
                        {d.margemPct.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
