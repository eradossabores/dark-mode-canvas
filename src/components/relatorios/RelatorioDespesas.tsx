import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DollarSign, Users, Receipt, TrendingDown } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth } from "date-fns";

const COLORS = ["hsl(200,98%,39%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(0,72%,50%)", "hsl(213,93%,67%)", "hsl(280,60%,50%)"];

interface ContaPagar {
  id: string;
  descricao: string;
  tipo: string;
  valor_parcela: number;
  total_parcelas: number;
  parcela_atual: number;
  created_at: string;
  proxima_parcela_data: string | null;
  ativa: boolean;
}

export default function RelatorioDespesas() {
  const { factoryId, factoryName, branding } = useAuth();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producaoFunc, setProducaoFunc] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { loadData(); }, [factoryId]);
  useEffect(() => { setPreviewLoaded(false); }, [startDate, endDate]);

  async function loadData() {
    let cQ = (supabase as any).from("contas_a_pagar").select("*").eq("ativa", true);
    let fQ = (supabase as any).from("funcionarios").select("*").eq("ativo", true);
    let pfQ = (supabase as any).from("producao_funcionarios").select("*, funcionarios(nome, tipo_pagamento, valor_pagamento), producoes(created_at)");
    if (factoryId) {
      cQ = cQ.eq("factory_id", factoryId);
      fQ = fQ.eq("factory_id", factoryId);
      pfQ = pfQ.eq("factory_id", factoryId);
    }
    const [c, f, pf] = await Promise.all([cQ, fQ, pfQ]);
    setContas(c.data || []);
    setFuncionarios(f.data || []);
    setProducaoFunc(pf.data || []);
  }

  const dados = useMemo(() => {
    if (!startDate || !endDate) return null;

    // --- Contas a Pagar ---
    const contasFixas = contas.filter(c => c.tipo === "fixo");
    const contasParceladas = contas.filter(c => c.tipo === "parcelado");

    // Calculate months in range
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / 86400000));

    const totalFixos = contasFixas.reduce((s, c) => s + c.valor_parcela, 0);
    const totalParcelados = contasParceladas.filter(c => {
      const created = new Date(c.created_at);
      return startOfMonth(created) <= startOfMonth(endDate);
    }).reduce((s, c) => s + c.valor_parcela, 0);

    // Detail rows for contas
    const contasRows = contas.map(c => ({
      categoria: "Conta a Pagar",
      descricao: c.descricao,
      tipo: c.tipo === "fixo" ? "Fixo" : "Parcelado",
      valor: c.valor_parcela,
    }));

    // --- Colaboradores (diárias) ---
    const filteredPf = producaoFunc.filter((pf: any) => {
      const d = new Date(pf.producoes?.created_at);
      if (d < startDate) return false;
      if (d > new Date(endDate.getTime() + 86400000)) return false;
      return true;
    });

    const funcMap: Record<string, { nome: string; tipo: string; valor: number; dias: Set<string> }> = {};
    filteredPf.forEach((pf: any) => {
      const fid = pf.funcionario_id;
      if (!funcMap[fid]) {
        funcMap[fid] = {
          nome: pf.funcionarios?.nome || "?",
          tipo: pf.funcionarios?.tipo_pagamento || "diaria",
          valor: Number(pf.funcionarios?.valor_pagamento || 0),
          dias: new Set(),
        };
      }
      const day = new Date(pf.producoes?.created_at).toISOString().split("T")[0];
      funcMap[fid].dias.add(day);
    });

    // Include fixo employees
    funcionarios.forEach((f: any) => {
      if (!funcMap[f.id] && f.tipo_pagamento === "fixo") {
        funcMap[f.id] = { nome: f.nome, tipo: "fixo", valor: Number(f.valor_pagamento), dias: new Set() };
      }
    });

    let totalColaboradores = 0;
    const colabRows = Object.entries(funcMap).map(([, f]) => {
      let custo = 0;
      if (f.tipo === "diaria") {
        custo = f.dias.size * f.valor;
      } else {
        custo = (f.valor / 30) * diffDays;
      }
      totalColaboradores += custo;
      return {
        categoria: "Colaborador",
        descricao: f.nome,
        tipo: f.tipo === "diaria" ? "Diária" : "Fixo",
        valor: custo,
      };
    });

    const totalContas = totalFixos + totalParcelados;
    const totalGeral = totalContas + totalColaboradores;

    // Pie chart
    const pieData = [
      { name: "Contas Fixas", value: totalFixos },
      { name: "Contas Parceladas", value: totalParcelados },
      { name: "Colaboradores", value: totalColaboradores },
    ].filter(d => d.value > 0);

    // All detail rows
    const allRows = [...contasRows, ...colabRows].sort((a, b) => b.valor - a.valor);

    return { totalContas, totalColaboradores, totalGeral, totalFixos, totalParcelados, pieData, allRows };
  }, [contas, funcionarios, producaoFunc, startDate, endDate]);

  const periodoLabel = `${startDate?.toLocaleDateString("pt-BR") || "—"} a ${endDate?.toLocaleDateString("pt-BR") || "—"}`;

  const headers = ["Categoria", "Descrição", "Tipo", "Valor (R$)"];
  const rows = dados?.allRows.map(r => [r.categoria, r.descricao, r.tipo, `R$ ${r.valor.toFixed(2)}`]) || [];

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <ExportButtons
          onPreview={() => setPreviewLoaded(true)}
          previewLoaded={previewLoaded}
          onPDF={() => exportToPDF("Relatório de Despesas", headers, rows, "relatorio-despesas", [
            { label: "Total Geral", value: `R$ ${dados?.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}` },
            { label: "Contas a Pagar", value: `R$ ${dados?.totalContas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}` },
            { label: "Colaboradores", value: `R$ ${dados?.totalColaboradores.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}` },
            { label: "Período", value: periodoLabel },
          ], "charts-despesas", { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl })}
          onExcel={() => exportToExcel(headers, rows, "Despesas", "relatorio-despesas")}
        />
      </DateRangeFilter>

      {!previewLoaded ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Selecione os filtros e clique em "Visualizar Relatório"</p>
            <p className="text-sm mt-1">A pré-visualização será exibida aqui.</p>
          </CardContent>
        </Card>
      ) : !dados || dados.allRows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">Não há despesas no período selecionado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground font-medium">Período: {periodoLabel}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Despesas" value={`R$ ${dados.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
            <KpiCard title="Contas a Pagar" value={`R$ ${dados.totalContas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Receipt} />
            <KpiCard title="Colaboradores" value={`R$ ${dados.totalColaboradores.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Users} />
            <KpiCard title="Itens de Despesa" value={dados.allRows.length.toString()} icon={TrendingDown} />
          </div>

          <div id="charts-despesas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-chart-export>
                <CardHeader><CardTitle className="text-sm">Composição das Despesas</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={dados.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {dados.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card data-chart-export>
                <CardHeader><CardTitle className="text-sm">Top 10 Maiores Despesas</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dados.allRows.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={v => `R$${v}`} />
                      <YAxis type="category" dataKey="descricao" fontSize={11} width={75} />
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                      <Bar dataKey="valor" name="Valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Detalhamento de Despesas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>{headers.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {dados.allRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant={r.categoria === "Colaborador" ? "secondary" : "outline"}>
                          {r.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{r.descricao}</TableCell>
                      <TableCell>{r.tipo}</TableCell>
                      <TableCell className="font-bold">R$ {r.valor.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTAL</TableCell>
                    <TableCell>R$ {dados.totalGeral.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
