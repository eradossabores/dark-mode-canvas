import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Package, Users, ShoppingCart, Factory, Warehouse, TrendingUp, AlertTriangle } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(200,98%,39%)", "hsl(213,93%,67%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(215,20%,65%)", "hsl(0,72%,50%)"];

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

  // KPIs
  const totalVendas = filteredVendas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalProduzido = filteredProducoes.reduce((s, p) => s + p.quantidade_total, 0);
  const totalClientes = clientes.filter(c => c.status === "ativo").length;
  const totalEstoque = estoqueGelos.reduce((s, e) => s + e.quantidade, 0);
  const ticketMedio = filteredVendas.length ? totalVendas / filteredVendas.length : 0;
  const clientesInativos = clientes.filter(c => c.status === "inativo").length;
  const mpBaixo = materiasPrimas.filter(m => m.estoque_atual <= m.estoque_minimo).length;
  const embBaixo = embalagens.filter(e => e.estoque_atual <= e.estoque_minimo).length;

  // Charts data
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

  // Export data
  const headers = [
    "Seção", "Indicador", "Valor"
  ];
  const rows: (string | number)[][] = [
    ["Vendas", "Total Faturado", `R$ ${totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Vendas", "Nº de Vendas", filteredVendas.length],
    ["Vendas", "Ticket Médio", `R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Produção", "Total Produzido", `${totalProduzido.toLocaleString("pt-BR")} un`],
    ["Produção", "Nº de Produções", filteredProducoes.length],
    ["Clientes", "Clientes Ativos", totalClientes],
    ["Clientes", "Clientes Inativos", clientesInativos],
    ["Estoque", "Total em Estoque", `${totalEstoque.toLocaleString("pt-BR")} un`],
    ["Estoque", "Matérias-Primas Baixas", mpBaixo],
    ["Estoque", "Embalagens Baixas", embBaixo],
  ];

  // Add top clients
  topClientes.slice(0, 5).forEach((c, i) => {
    rows.push(["Top Clientes", `${i + 1}º - ${c.name}`, `R$ ${c.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`]);
  });

  // Add stock by flavor
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
            { label: "Total Faturado", value: `R$ ${totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
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

          {/* KPIs Row 1 - Financeiro */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Faturamento" value={`R$ ${totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
            <KpiCard title="Nº de Vendas" value={filteredVendas.length.toString()} icon={ShoppingCart} />
            <KpiCard title="Ticket Médio" value={`R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} />
            <KpiCard title="Produzido" value={`${totalProduzido.toLocaleString("pt-BR")} un`} icon={Factory} />
          </div>

          {/* KPIs Row 2 - Operacional */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Clientes Ativos" value={totalClientes.toString()} icon={Users} />
            <KpiCard title="Estoque Total" value={`${totalEstoque.toLocaleString("pt-BR")} un`} icon={Warehouse} />
            <KpiCard title="MP em Alerta" value={mpBaixo.toString()} icon={AlertTriangle} subtitle={mpBaixo > 0 ? "abaixo do mínimo" : "ok"} />
            <KpiCard title="Embalagens Alerta" value={embBaixo.toString()} icon={Package} subtitle={embBaixo > 0 ? "abaixo do mínimo" : "ok"} />
          </div>

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
                    <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
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
                    <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
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

          {/* Alertas de Estoque */}
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

          {/* Resumo de Vendas Recentes */}
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
                      <span className="text-sm font-bold">R$ {Number(v.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
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
