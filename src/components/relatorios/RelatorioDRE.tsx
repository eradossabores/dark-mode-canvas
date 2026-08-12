import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";
import DateRangeFilter from "@/components/relatorios/DateRangeFilter";

interface Props {
  factoryId: string | null;
  dateRange?: { from: Date; to: Date } | null;
}

const CATEGORIA_LABELS: Record<string, string> = {
  aluguel: "🏠 Aluguel",
  veiculo: "🚗 Veículo",
  equipamento: "⚙️ Equipamento",
  energia: "⚡ Energia",
  agua: "💧 Água",
  internet: "🌐 Internet/Telefone",
  salario: "👤 Salários",
  manutencao: "🔧 Manutenção",
  materia_prima: "📦 Matéria-prima",
  outros: "📋 Outros",
};

interface DreData {
  receitaBruta: number;
  amostras: number;
  receitaFrete: number;
  cmv: number;
  despesasPorCategoria: Record<string, number>;
  despesasTotal: number;
  despesasAvulsasPorCategoria: Record<string, number>;
  despesasAvulsasTotal: number;
  comissoes: number;
  ajudaCusto: number;
  qtdVendas: number;
  ticketMedio: number;
}

export default function RelatorioDRE({ factoryId, dateRange }: Props) {
  const [data, setData] = useState<DreData | null>(null);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();
  const [inicio, setInicio] = useState<Date | undefined>(
    dateRange?.from ?? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  );
  const [fim, setFim] = useState<Date | undefined>(dateRange?.to ?? hoje);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryId, inicio, fim]);

  async function loadData() {
    setLoading(true);
    try {
      const base = new Date();
      const from = inicio ? new Date(new Date(inicio).setHours(0, 0, 0, 0)) : new Date(base.getFullYear(), base.getMonth(), 1);
      const to = fim ? new Date(new Date(fim).setHours(23, 59, 59, 999)) : base;
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      const [vendasR, comprasR, pagR, comR, ajudaR, despR] = await Promise.all([
        (supabase as any).from("vendas").select("total, valor_frete, forma_pagamento, status")
          .eq("factory_id", factoryId).neq("status", "cancelada")
          .gte("created_at", fromIso).lte("created_at", toIso),
        (supabase as any).from("compras").select("custo_total_com_frete, tipo")
          .eq("factory_id", factoryId).gte("created_at", fromIso).lte("created_at", toIso),
        (supabase as any).from("pagamentos_contas")
          .select("valor, conta_id, contas_a_pagar(categoria, descricao)")
          .eq("factory_id", factoryId).gte("data_pagamento", fromIso).lte("data_pagamento", toIso),
        (supabase as any).from("comissoes_vendas").select("valor_comissao, pago_em")
          .eq("factory_id", factoryId).not("pago_em", "is", null)
          .gte("pago_em", fromIso).lte("pago_em", toIso),
        (supabase as any).from("ajuda_custo_vendedor").select("valor, semana_inicio, status")
          .eq("factory_id", factoryId).eq("status", "pago")
          .gte("semana_inicio", from.toISOString().slice(0, 10))
          .lte("semana_inicio", to.toISOString().slice(0, 10)),
        (supabase as any).from("despesas").select("valor, categoria, data_despesa, pago")
          .eq("factory_id", factoryId).eq("pago", true)
          .gte("data_despesa", from.toISOString().slice(0, 10))
          .lte("data_despesa", to.toISOString().slice(0, 10)),
      ]);

      const vendas = vendasR.data || [];
      const receitaBruta = vendas.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
      const amostras = vendas.filter((v: any) => v.forma_pagamento === "amostra")
        .reduce((s: number, v: any) => s + Number(v.total || 0), 0);
      const receitaFrete = vendas.reduce((s: number, v: any) => s + Number(v.valor_frete || 0), 0);

      const cmv = (comprasR.data || []).reduce((s: number, c: any) => s + Number(c.custo_total_com_frete || 0), 0);

      const despesasPorCategoria: Record<string, number> = {};
      (pagR.data || []).forEach((p: any) => {
        const cat = p.contas_a_pagar?.categoria || "outros";
        despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + Number(p.valor || 0);
      });
      const despesasTotal = Object.values(despesasPorCategoria).reduce((s, v) => s + v, 0);

      const despesasAvulsasPorCategoria: Record<string, number> = {};
      (despR.data || []).forEach((d: any) => {
        const cat = d.categoria || "outros";
        despesasAvulsasPorCategoria[cat] = (despesasAvulsasPorCategoria[cat] || 0) + Number(d.valor || 0);
      });
      const despesasAvulsasTotal = Object.values(despesasAvulsasPorCategoria).reduce((s, v) => s + v, 0);

      const comissoes = (comR.data || []).reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0);
      const ajudaCusto = (ajudaR.data || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);

      const qtdVendas = vendas.filter((v: any) => v.forma_pagamento !== "amostra").length;
      const ticketMedio = qtdVendas > 0 ? (receitaBruta - amostras) / qtdVendas : 0;

      setData({
        receitaBruta, amostras, receitaFrete, cmv,
        despesasPorCategoria, despesasTotal,
        despesasAvulsasPorCategoria, despesasAvulsasTotal,
        comissoes, ajudaCusto, qtdVendas, ticketMedio,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const filtro = (
    <DateRangeFilter startDate={inicio} endDate={fim} onStartChange={setInicio} onEndChange={setFim} />
  );

  if (loading || !data)
    return (
      <div>
        {filtro}
        <div className="animate-pulse p-4 text-muted-foreground">Carregando DRE...</div>
      </div>
    );

  const receitaLiquida = data.receitaBruta - data.amostras;
  const lucroBruto = receitaLiquida - data.cmv;
  const lucroOperacional = lucroBruto - data.despesasTotal - data.despesasAvulsasTotal;
  const lucroLiquido = lucroOperacional - data.comissoes - data.ajudaCusto;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  type Linha = { label: string; valor: number; bold?: boolean; isTotal?: boolean; indent?: boolean };

  const linhasSimples: Linha[] = [
    { label: "Receita Bruta (Vendas)", valor: data.receitaBruta, bold: true },
    { label: "(-) Custo da Mercadoria Vendida", valor: -data.cmv },
    { label: "= Lucro Bruto", valor: lucroBruto, bold: true, isTotal: true },
    { label: "(-) Despesas Operacionais", valor: -(data.despesasTotal + data.despesasAvulsasTotal + data.comissoes + data.ajudaCusto) },
    { label: "= Lucro Líquido", valor: lucroLiquido, bold: true, isTotal: true },
  ];

  const linhasDetalhadas: Linha[] = [
    { label: "Receita Bruta de Vendas", valor: data.receitaBruta, bold: true },
    { label: "(-) Amostras / Brindes", valor: -data.amostras, indent: true },
    { label: "= Receita Líquida", valor: receitaLiquida, bold: true, isTotal: true },
    { label: "(-) CMV (Compras de Insumos + Frete)", valor: -data.cmv },
    { label: "= Lucro Bruto", valor: lucroBruto, bold: true, isTotal: true },
    ...Object.entries(data.despesasPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        label: `(-) ${CATEGORIA_LABELS[cat] || cat}`,
        valor: -val,
        indent: true,
      })),
    ...Object.entries(data.despesasAvulsasPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        label: `(-) Despesa avulsa — ${CATEGORIA_LABELS[cat] || cat}`,
        valor: -val,
        indent: true,
      })),
    { label: "(-) Comissões de Vendedores", valor: -data.comissoes, indent: true },
    { label: "(-) Ajuda de Custo", valor: -data.ajudaCusto, indent: true },
    { label: "= Lucro Operacional", valor: lucroOperacional, bold: true, isTotal: true },
    { label: "+ Receita de Frete (informativo)", valor: data.receitaFrete, indent: true },
    { label: "= Lucro Líquido", valor: lucroLiquido, bold: true, isTotal: true },
  ];

  const renderLinhas = (linhas: Linha[]) => (
    <div className="space-y-1">
      {linhas.map((l, i) => (
        <div key={i} className={`flex justify-between items-center px-2 py-1.5 rounded ${l.isTotal ? "bg-muted/50 border" : ""} ${l.indent ? "pl-6" : ""}`}>
          <span className={`text-xs ${l.bold ? "font-bold" : "text-muted-foreground"}`}>{l.label}</span>
          <span className={`text-xs ${l.bold ? "font-bold" : ""} ${l.valor < 0 ? "text-destructive" : l.isTotal && l.valor > 0 ? "text-green-500" : ""}`}>
            {fmt(l.valor)}
          </span>
        </div>
      ))}
    </div>
  );

  const indicadores = (
    <div className="mt-3 pt-2 border-t grid grid-cols-3 gap-2 text-center">
      <div>
        <div className="text-[10px] text-muted-foreground">Margem Bruta</div>
        <div className={`text-sm font-bold ${margemBruta >= 0 ? "text-green-500" : "text-destructive"}`}>{margemBruta.toFixed(1)}%</div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground">Margem Líquida</div>
        <div className={`text-sm font-bold ${margemLiquida >= 0 ? "text-green-500" : "text-destructive"}`}>{margemLiquida.toFixed(1)}%</div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground">Ticket Médio</div>
        <div className="text-sm font-bold">{fmt(data.ticketMedio)}</div>
      </div>
    </div>
  );

  return (
    <div>
      {filtro}
      <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          DRE — Demonstração de Resultado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="simplificada">
          <TabsList className="mb-3">
            <TabsTrigger value="simplificada">Simplificada</TabsTrigger>
            <TabsTrigger value="detalhada">Detalhada</TabsTrigger>
          </TabsList>
          <TabsContent value="simplificada">
            {renderLinhas(linhasSimples)}
            {indicadores}
          </TabsContent>
          <TabsContent value="detalhada">
            {renderLinhas(linhasDetalhadas)}
            {indicadores}
            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              <strong>Observação:</strong> CMV usa compras de insumos do período (regime de caixa).
              Para um DRE em regime de competência (consumo real de matéria-prima), seria
              necessário rastrear estoque inicial/final + receitas das produções no período.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
      </Card>
    </div>
  );
}
