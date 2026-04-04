import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Package, Users, ShoppingCart, Factory, Warehouse, TrendingUp, AlertTriangle, Calculator, Lightbulb, Target, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(200,98%,39%)", "hsl(213,93%,67%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(215,20%,65%)", "hsl(0,72%,50%)"];

const formatBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const parseBRL = (v: string) => parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

function FinanceiroSection({ totalVendasAuto, totalDespesasFixasAuto }: { totalVendasAuto: number; totalDespesasFixasAuto: number }) {
  const [receitaInput, setReceitaInput] = useState<string>("");
  const [cmvInput, setCmvInput] = useState<string>("");
  const [despesasFixasInput, setDespesasFixasInput] = useState<string>("");
  const [useAutoReceita, setUseAutoReceita] = useState(true);
  const [useAutoDespesas, setUseAutoDespesas] = useState(true);

  const receita = useAutoReceita ? totalVendasAuto : parseBRL(receitaInput);
  const cmv = parseBRL(cmvInput);
  const despesasFixas = useAutoDespesas ? totalDespesasFixasAuto : parseBRL(despesasFixasInput);

  const lucroBruto = receita - cmv;
  const lucroLiquido = lucroBruto - despesasFixas;
  const margemContribuicao = receita > 0 ? ((receita - cmv) / receita) * 100 : 0;
  const pontoEquilibrio = margemContribuicao > 0 ? despesasFixas / (margemContribuicao / 100) : 0;
  const pctCustoSobreReceita = receita > 0 ? ((cmv + despesasFixas) / receita) * 100 : 0;
  const faltaParaEquilibrio = receita > 0 && pontoEquilibrio > 0 ? Math.max(0, pontoEquilibrio - receita) : 0;

  // Status
  const statusColor = lucroLiquido > 0 ? "emerald" : lucroLiquido === 0 ? "amber" : "red";
  const statusEmoji = lucroLiquido > 0 ? "🟢" : lucroLiquido === 0 ? "🟡" : "🔴";
  const statusLabel = lucroLiquido > 0 ? "Saudável" : lucroLiquido === 0 ? "Atenção" : "Prejuízo";

  const hasInputs = cmv > 0 || despesasFixas > 0;

  // Insights
  const insights: { icon: string; text: string; type: "success" | "warning" | "danger" }[] = [];
  if (hasInputs && receita > 0) {
    if (lucroLiquido > 0) {
      insights.push({ icon: "✅", text: `Sua empresa está lucrando! Margem líquida de ${formatPct((lucroLiquido / receita) * 100)}.`, type: "success" });
    } else if (lucroLiquido < 0) {
      insights.push({ icon: "🚨", text: `Sua empresa está no prejuízo de ${formatBRL(Math.abs(lucroLiquido))}. Ação urgente necessária.`, type: "danger" });
    }
    if (pctCustoSobreReceita > 0) {
      insights.push({ icon: "📊", text: `${formatPct(pctCustoSobreReceita)} da receita está comprometida com custos (variáveis + fixos).`, type: pctCustoSobreReceita > 90 ? "danger" : pctCustoSobreReceita > 70 ? "warning" : "success" });
    }
    if (faltaParaEquilibrio > 0) {
      insights.push({ icon: "🎯", text: `Faltam ${formatBRL(faltaParaEquilibrio)} em faturamento para atingir o ponto de equilíbrio.`, type: "warning" });
    } else if (pontoEquilibrio > 0 && receita >= pontoEquilibrio) {
      insights.push({ icon: "🏆", text: `Você já ultrapassou o ponto de equilíbrio em ${formatBRL(receita - pontoEquilibrio)}!`, type: "success" });
    }
    if (margemContribuicao <= 0) {
      insights.push({ icon: "⚠️", text: "Margem de contribuição zerada ou negativa. O custo variável está consumindo toda a receita.", type: "danger" });
    }
  }

  // Suggestions
  const suggestions: string[] = [];
  if (hasInputs && receita > 0) {
    if (lucroLiquido < 0) {
      suggestions.push("Reduza custos variáveis renegociando com fornecedores.");
      suggestions.push("Avalie aumentar o preço de venda para melhorar a margem.");
      suggestions.push("Aumente o volume de vendas para diluir as despesas fixas.");
    } else if (margemContribuicao < 30) {
      suggestions.push("Margem baixa — considere revisar o preço dos produtos.");
      suggestions.push("Busque fornecedores alternativos para reduzir o CMV.");
    }
    if (pctCustoSobreReceita > 85) {
      suggestions.push("Custos representam mais de 85% da receita. Reavalie a estrutura de custos.");
    }
  }

  const insightBg = { success: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800", warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", danger: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" };
  const insightText = { success: "text-emerald-800 dark:text-emerald-300", warning: "text-amber-800 dark:text-amber-300", danger: "text-red-800 dark:text-red-300" };

  return (
    <div className="space-y-4">
      {/* Executive summary */}
      {hasInputs && receita > 0 && (
        <Card className={`border-2 ${statusColor === "emerald" ? "border-emerald-400 dark:border-emerald-600" : statusColor === "amber" ? "border-amber-400 dark:border-amber-600" : "border-red-400 dark:border-red-600"}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{statusEmoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`text-xs ${statusColor === "emerald" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : statusColor === "amber" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                    {statusLabel}
                  </Badge>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {lucroLiquido > 0
                    ? `Seu negócio está operando com lucro de ${formatPct((lucroLiquido / receita) * 100)} e ${pontoEquilibrio > 0 ? `precisa faturar ${formatBRL(pontoEquilibrio)} para atingir o equilíbrio` : "está acima do ponto de equilíbrio"}.`
                    : lucroLiquido === 0
                    ? "Seu negócio está no ponto de equilíbrio — sem lucro nem prejuízo."
                    : `Seu negócio está operando com prejuízo de ${formatBRL(Math.abs(lucroLiquido))}. É necessário ${pontoEquilibrio > 0 ? `faturar pelo menos ${formatBRL(pontoEquilibrio)}` : "revisar custos"} para reverter.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Indicadores Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Receita Total — R$</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={formatBRL(totalVendasAuto)}
                  value={useAutoReceita ? "" : receitaInput}
                  onChange={e => {
                    setUseAutoReceita(false);
                    setReceitaInput(e.target.value.replace(/[^0-9.,]/g, ""));
                  }}
                  className="h-9"
                />
                {!useAutoReceita && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-9 px-2 shrink-0"
                    onClick={() => { setUseAutoReceita(true); setReceitaInput(""); }}
                  >
                    Auto
                  </Button>
                )}
              </div>
              {useAutoReceita && <p className="text-[10px] text-muted-foreground">Usando faturamento do período: {formatBRL(totalVendasAuto)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">CMV (Custo Variável) — R$</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={cmvInput}
                onChange={e => setCmvInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Despesas Fixas — R$</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={formatBRL(totalDespesasFixasAuto)}
                  value={useAutoDespesas ? "" : despesasFixasInput}
                  onChange={e => {
                    setUseAutoDespesas(false);
                    setDespesasFixasInput(e.target.value.replace(/[^0-9.,]/g, ""));
                  }}
                  className="h-9"
                />
                {!useAutoDespesas && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-9 px-2 shrink-0"
                    onClick={() => { setUseAutoDespesas(true); setDespesasFixasInput(""); }}
                  >
                    Auto
                  </Button>
                )}
              </div>
              {useAutoDespesas && <p className="text-[10px] text-muted-foreground">Usando contas a pagar: {formatBRL(totalDespesasFixasAuto)}</p>}
            </div>
          </div>

          {/* Results cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-card">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Lucro Bruto</p>
              <p className={`text-xl font-bold ${lucroBruto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {formatBRL(lucroBruto)}
              </p>
              <p className="text-[10px] text-muted-foreground">Receita − CMV</p>
            </div>
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-card">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Lucro Líquido</p>
              <p className={`text-xl font-bold ${lucroLiquido >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {formatBRL(lucroLiquido)}
              </p>
              <p className="text-[10px] text-muted-foreground">L. Bruto − Desp. Fixas</p>
              {lucroLiquido < 0 && <Badge variant="destructive" className="text-[9px]">Prejuízo</Badge>}
            </div>
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-card">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Margem Contribuição</p>
              <p className={`text-xl font-bold ${margemContribuicao > 0 ? "text-emerald-600 dark:text-emerald-400" : margemContribuicao === 0 ? "text-muted-foreground" : "text-destructive"}`}>
                {receita > 0 ? formatPct(margemContribuicao) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">(Receita − CMV) / Receita</p>
              {margemContribuicao <= 0 && receita > 0 && <Badge variant="destructive" className="text-[9px]">Margem zerada</Badge>}
            </div>
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-card">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Ponto de Equilíbrio</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {margemContribuicao > 0 ? formatBRL(pontoEquilibrio) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Desp. Fixas / Margem</p>
            </div>
          </div>

          {/* Alerts */}
          {hasInputs && receita > 0 && (lucroLiquido < 0 || margemContribuicao <= 0) && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 flex items-start gap-2">
              <CircleAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                {lucroLiquido < 0 && <p className="text-xs text-red-800 dark:text-red-300 font-medium">⚠️ Lucro líquido negativo — seu negócio está operando no prejuízo.</p>}
                {margemContribuicao <= 0 && <p className="text-xs text-red-800 dark:text-red-300 font-medium">⚠️ Margem de contribuição zerada ou negativa — o custo variável supera a receita.</p>}
              </div>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Insights
              </p>
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <div key={i} className={`rounded-lg border p-2.5 ${insightBg[ins.type]}`}>
                    <p className={`text-xs ${insightText[ins.type]}`}>{ins.icon} {ins.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Sugestões
              </p>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RelatorioCompleto() {
  const { factoryId, factoryName, branding } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const [vendas, setVendas] = useState<any[]>([]);
  const [vendaItens, setVendaItens] = useState<any[]>([]);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [estoqueGelos, setEstoqueGelos] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<any[]>([]);
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [contasAPagar, setContasAPagar] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [factoryId]);
  useEffect(() => { setPreviewLoaded(false); }, [startDate, endDate]);

  async function loadData() {
    const fid = factoryId;
    const queries = [
      (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }),
      (supabase as any).from("venda_itens").select("*, sabores(nome)"),
      (supabase as any).from("producoes").select("*, sabores(nome)").order("created_at", { ascending: false }),
      (supabase as any).from("clientes").select("*"),
      (supabase as any).from("estoque_gelos").select("*, sabores(nome)"),
      (supabase as any).from("sabores").select("id, nome"),
      (supabase as any).from("funcionarios").select("*"),
      (supabase as any).from("materias_primas").select("*"),
      (supabase as any).from("embalagens").select("*"),
      (supabase as any).from("contas_a_pagar").select("*").eq("ativa", true),
    ];

    if (fid) {
      queries.forEach((q, i) => { queries[i] = q.eq("factory_id", fid); });
    }

    const results = await Promise.all(queries);
    setVendas(results[0].data || []);
    setVendaItens(results[1].data || []);
    setProducoes(results[2].data || []);
    setClientes(results[3].data || []);
    setEstoqueGelos(results[4].data || []);
    setSabores(results[5].data || []);
    setFuncionarios(results[6].data || []);
    setMateriasPrimas(results[7].data || []);
    setEmbalagens(results[8].data || []);
    setContasAPagar(results[9].data || []);
  }

  const filteredVendas = useMemo(() => vendas.filter((v) => {
    const d = new Date(v.created_at);
    if (startDate && d < startDate) return false;
    if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
    return true;
  }), [vendas, startDate, endDate]);

  const filteredProducoes = useMemo(() => producoes.filter((p) => {
    const d = new Date(p.created_at);
    if (startDate && d < startDate) return false;
    if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
    return true;
  }), [producoes, startDate, endDate]);

  const totalVendas = filteredVendas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalProduzido = filteredProducoes.reduce((s, p) => s + p.quantidade_total, 0);
  const totalClientes = clientes.filter(c => c.status === "ativo").length;
  const totalEstoque = estoqueGelos.reduce((s, e) => s + e.quantidade, 0);
  const ticketMedio = filteredVendas.length ? totalVendas / filteredVendas.length : 0;
  const clientesInativos = clientes.filter(c => c.status === "inativo").length;
  const mpBaixo = materiasPrimas.filter(m => m.estoque_atual <= m.estoque_minimo).length;
  const embBaixo = embalagens.filter(e => e.estoque_atual <= e.estoque_minimo).length;
  const totalDespesasFixas = contasAPagar.reduce((s, c) => s + Number(c.valor_parcela || 0), 0);

  const valorRecebido = filteredVendas.filter(v => v.status !== "cancelada").reduce((s, v) => s + Number(v.valor_pago || 0), 0);
  const valorPendente = filteredVendas.filter(v => v.status !== "cancelada").reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.valor_pago || 0)), 0);

  const vendasPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    filteredVendas.forEach(v => {
      const day = new Date(v.created_at).toLocaleDateString("pt-BR");
      map[day] = (map[day] || 0) + Number(v.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).reverse().slice(0, 15).reverse();
  }, [filteredVendas]);

  const producaoPorSabor = useMemo(() => {
    const map: Record<string, number> = {};
    filteredProducoes.forEach(p => {
      const nome = p.sabores?.nome || "?";
      map[nome] = (map[nome] || 0) + p.quantidade_total;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredProducoes]);

  const topClientes = useMemo(() => {
    const map: Record<string, number> = {};
    filteredVendas.forEach(v => {
      const nome = v.clientes?.nome || "?";
      map[nome] = (map[nome] || 0) + Number(v.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredVendas]);

  const estoquePorSabor = useMemo(() => {
    return estoqueGelos
      .map(e => ({ name: e.sabores?.nome || "?", value: e.quantidade }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [estoqueGelos]);

  const periodoLabel = `${startDate?.toLocaleDateString("pt-BR") || "—"} a ${endDate?.toLocaleDateString("pt-BR") || "—"}`;

  const headers = ["Seção", "Indicador", "Valor"];
  const rows: (string | number)[][] = [
    ["Vendas", "Total Faturado", formatBRL(totalVendas)],
    ["Vendas", "Valor Recebido", formatBRL(valorRecebido)],
    ["Vendas", "Pendente a Receber", formatBRL(valorPendente)],
    ["Vendas", "Nº de Vendas", filteredVendas.length],
    ["Vendas", "Ticket Médio", formatBRL(ticketMedio)],
    ["Produção", "Total Produzido", `${totalProduzido.toLocaleString("pt-BR")} un`],
    ["Produção", "Nº de Produções", filteredProducoes.length],
    ["Clientes", "Clientes Ativos", totalClientes],
    ["Clientes", "Clientes Inativos", clientesInativos],
    ["Estoque", "Total em Estoque", `${totalEstoque.toLocaleString("pt-BR")} un`],
    ["Estoque", "Matérias-Primas Baixas", mpBaixo],
    ["Estoque", "Embalagens Baixas", embBaixo],
  ];

  topClientes.slice(0, 5).forEach((c, i) => {
    rows.push(["Top Clientes", `${i + 1}º - ${c.name}`, formatBRL(c.value)]);
  });

  estoquePorSabor.slice(0, 5).forEach(e => {
    rows.push(["Estoque por Sabor", e.name, `${e.value.toLocaleString("pt-BR")} un`]);
  });

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <ExportButtons
          onPreview={() => setPreviewLoaded(true)}
          previewLoaded={previewLoaded}
          onPDF={() => exportToPDF("Relatório Completo", headers, rows, "relatorio-completo", [
            { label: "Período", value: periodoLabel },
            { label: "Total Faturado", value: formatBRL(totalVendas) },
            { label: "Total Produzido", value: `${totalProduzido.toLocaleString("pt-BR")} unidades` },
            { label: "Estoque Atual", value: `${totalEstoque.toLocaleString("pt-BR")} unidades` },
          ], "charts-completo", { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl })}
          onExcel={() => exportToExcel(headers, rows, "Relatório Completo", "relatorio-completo")}
        />
      </DateRangeFilter>

      {!previewLoaded ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Selecione o período e clique em "Visualizar Relatório"</p>
            <p className="text-sm mt-1">O relatório completo será gerado aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground font-medium">Período: {periodoLabel}</div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard title="Faturamento" value={formatBRL(totalVendas)} icon={DollarSign} />
            <KpiCard title="Valor Recebido" value={formatBRL(valorRecebido)} icon={DollarSign} subtitle="efetivamente recebido" />
            <KpiCard title="Pendente a Receber" value={formatBRL(valorPendente)} icon={AlertTriangle} subtitle={valorPendente > 0 ? "em aberto" : "nada pendente"} />
            <KpiCard title="Nº de Vendas" value={filteredVendas.length.toString()} icon={ShoppingCart} />
            <KpiCard title="Ticket Médio" value={formatBRL(ticketMedio)} icon={TrendingUp} />
            <KpiCard title="Produzido" value={`${totalProduzido.toLocaleString("pt-BR")} un`} icon={Factory} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Clientes Ativos" value={totalClientes.toString()} icon={Users} />
            <KpiCard title="Estoque Total" value={`${totalEstoque.toLocaleString("pt-BR")} un`} icon={Warehouse} />
            <KpiCard title="MP em Alerta" value={mpBaixo.toString()} icon={AlertTriangle} subtitle={mpBaixo > 0 ? "abaixo do mínimo" : "ok"} />
            <KpiCard title="Embalagens Alerta" value={embBaixo.toString()} icon={Package} subtitle={embBaixo > 0 ? "abaixo do mínimo" : "ok"} />
          </div>

          {/* Indicadores Financeiros */}
          <FinanceiroSection totalVendasAuto={totalVendas} totalDespesasFixasAuto={totalDespesasFixas} />

          {/* Charts */}
          <div id="charts-completo" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Faturamento por Dia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={vendasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="value" name="Faturamento" fill="hsl(200,98%,39%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Produção por Sabor</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={producaoPorSabor} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {producaoPorSabor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Top 10 Clientes (Faturamento)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topClientes} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis type="category" dataKey="name" fontSize={10} width={100} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="value" name="Total" fill="hsl(142,71%,45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Estoque por Sabor</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={estoquePorSabor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" name="Estoque" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {(mpBaixo > 0 || embBaixo > 0) && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Alertas de Estoque</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {materiasPrimas.filter(m => m.estoque_atual <= m.estoque_minimo).map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{m.nome}</span>
                    <Badge variant="destructive" className="text-xs">
                      {m.estoque_atual} / mín. {m.estoque_minimo} {m.unidade}
                    </Badge>
                  </div>
                ))}
                {embalagens.filter(e => e.estoque_atual <= e.estoque_minimo).map(e => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{e.nome}</span>
                    <Badge variant="destructive" className="text-xs">
                      {e.estoque_atual} / mín. {e.estoque_minimo}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Últimas 10 Vendas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredVendas.slice(0, 10).map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{v.clientes?.nome || "—"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={v.status === "paga" ? "default" : "outline"} className="text-xs">
                        {v.status}
                      </Badge>
                      <span className="text-sm font-bold">{formatBRL(Number(v.total))}</span>
                    </div>
                  </div>
                ))}
                {filteredVendas.length === 0 && <p className="text-center text-muted-foreground py-4">Nenhuma venda no período.</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
