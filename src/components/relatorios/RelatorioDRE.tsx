import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

interface Props {
  factoryId: string | null;
  dateRange?: { from: Date; to: Date } | null;
}

export default function RelatorioDRE({ factoryId, dateRange }: Props) {
  const [dre, setDre] = useState({
    receitas: 0,
    custosMercadoria: 0,
    despesasOperacionais: 0,
    lucroBruto: 0,
    lucroLiquido: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId, dateRange]);

  async function loadData() {
    setLoading(true);
    try {
      const from = dateRange?.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = dateRange?.to || new Date();

      // Receitas (vendas)
      const { data: vendas } = await (supabase as any)
        .from("vendas")
        .select("total")
        .eq("factory_id", factoryId)
        .neq("status", "cancelada")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

      const receitas = (vendas || []).reduce((s: number, v: any) => s + Number(v.total), 0);

      // Custos (compras de insumos)
      const { data: compras } = await (supabase as any)
        .from("compras")
        .select("custo_total_com_frete")
        .eq("factory_id", factoryId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

      const custos = (compras || []).reduce((s: number, c: any) => s + Number(c.custo_total_com_frete), 0);

      // Despesas operacionais (contas a pagar - pagamentos no período)
      const { data: pagamentos } = await (supabase as any)
        .from("pagamentos_contas")
        .select("valor")
        .eq("factory_id", factoryId)
        .gte("data_pagamento", from.toISOString())
        .lte("data_pagamento", to.toISOString());

      const despesas = (pagamentos || []).reduce((s: number, p: any) => s + Number(p.valor), 0);

      const lucroBruto = receitas - custos;
      const lucroLiquido = lucroBruto - despesas;

      setDre({ receitas, custosMercadoria: custos, despesasOperacionais: despesas, lucroBruto, lucroLiquido });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="animate-pulse p-4 text-muted-foreground">Carregando DRE...</div>;

  const linhas = [
    { label: "Receita Bruta (Vendas)", valor: dre.receitas, bold: true, isTotal: false },
    { label: "(-) Custo da Mercadoria Vendida", valor: -dre.custosMercadoria, bold: false, isTotal: false },
    { label: "= Lucro Bruto", valor: dre.lucroBruto, bold: true, isTotal: true },
    { label: "(-) Despesas Operacionais", valor: -dre.despesasOperacionais, bold: false, isTotal: false },
    { label: "= Lucro Líquido", valor: dre.lucroLiquido, bold: true, isTotal: true },
  ];

  const margemLiquida = dre.receitas > 0 ? (dre.lucroLiquido / dre.receitas) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          DRE Simplificado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {linhas.map((l, i) => (
            <div key={i} className={`flex justify-between items-center px-2 py-1.5 rounded ${l.isTotal ? "bg-muted/50 border" : ""}`}>
              <span className={`text-xs ${l.bold ? "font-bold" : "text-muted-foreground"}`}>{l.label}</span>
              <span className={`text-xs ${l.bold ? "font-bold" : ""} ${l.valor < 0 ? "text-destructive" : l.isTotal && l.valor > 0 ? "text-green-500" : ""}`}>
                R$ {Math.abs(l.valor).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Margem Líquida</span>
          <span className={`text-sm font-bold ${margemLiquida >= 0 ? "text-green-500" : "text-destructive"}`}>
            {margemLiquida.toFixed(1)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
