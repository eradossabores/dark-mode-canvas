import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Users, Calendar, TrendingUp } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(200,98%,39%)", "hsl(213,93%,67%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(215,20%,65%)", "hsl(0,72%,50%)"];

export default function RelatorioColaboradores() {
  const { factoryId, factoryName, branding } = useAuth();
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producaoFunc, setProducaoFunc] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { loadData(); }, [factoryId]);
  useEffect(() => { setPreviewLoaded(false); }, [startDate, endDate]);

  async function loadData() {
    let fQ = (supabase as any).from("funcionarios").select("*");
    let pfQ = (supabase as any).from("producao_funcionarios").select("*, funcionarios(nome, tipo_pagamento, valor_pagamento), producoes(created_at)");
    if (factoryId) { fQ = fQ.eq("factory_id", factoryId); pfQ = pfQ.eq("factory_id", factoryId); }
    const [f, pf] = await Promise.all([fQ, pfQ]);
    setFuncionarios(f.data || []);
    setProducaoFunc(pf.data || []);
  }

  const dados = useMemo(() => {
    const filtered = producaoFunc.filter((pf: any) => {
      const d = new Date(pf.producoes?.created_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
      return true;
    });

    // Count distinct days per employee
    const funcMap: Record<string, { nome: string; tipo: string; valor_pagamento: number; dias: Set<string>; producoes: number; unidades: number }> = {};

    filtered.forEach((pf: any) => {
      const fid = pf.funcionario_id;
      const day = new Date(pf.producoes?.created_at).toISOString().split("T")[0];
      if (!funcMap[fid]) {
        funcMap[fid] = {
          nome: pf.funcionarios?.nome || "?",
          tipo: pf.funcionarios?.tipo_pagamento || "diaria",
          valor_pagamento: Number(pf.funcionarios?.valor_pagamento || 0),
          dias: new Set(),
          producoes: 0,
          unidades: 0,
        };
      }
      funcMap[fid].dias.add(day);
      funcMap[fid].producoes += 1;
      funcMap[fid].unidades += pf.quantidade_produzida || 0;
    });

    // Include fixo employees that didn't produce
    funcionarios.forEach((f: any) => {
      if (!funcMap[f.id] && f.tipo_pagamento === "fixo" && f.ativo) {
        funcMap[f.id] = {
          nome: f.nome,
          tipo: "fixo",
          valor_pagamento: Number(f.valor_pagamento),
          dias: new Set(),
          producoes: 0,
          unidades: 0,
        };
      }
    });

    const detalhes = Object.entries(funcMap).map(([id, f]) => {
      let custo = 0;
      if (f.tipo === "diaria") {
        custo = f.dias.size * f.valor_pagamento;
      } else {
        // Calculate months in range
        if (startDate && endDate) {
          const diffMs = endDate.getTime() - startDate.getTime();
          const diffDays = Math.max(1, Math.ceil(diffMs / 86400000));
          custo = (f.valor_pagamento / 30) * diffDays;
        } else {
          custo = f.valor_pagamento;
        }
      }
      return {
        id,
        nome: f.nome,
        tipo: f.tipo,
        diasTrabalhados: f.dias.size,
        producoes: f.producoes,
        unidades: f.unidades,
        valorBase: f.valor_pagamento,
        custo,
      };
    }).sort((a, b) => b.custo - a.custo);

    const totalGasto = detalhes.reduce((s, d) => s + d.custo, 0);
    const totalDias = detalhes.reduce((s, d) => s + d.diasTrabalhados, 0);
    const totalUnidades = detalhes.reduce((s, d) => s + d.unidades, 0);

    // Cost per day chart
    const diaMap: Record<string, number> = {};
    filtered.forEach((pf: any) => {
      const day = new Date(pf.producoes?.created_at).toLocaleDateString("pt-BR");
      const f = funcMap[pf.funcionario_id];
      if (f && f.tipo === "diaria") {
        // Add daily rate once per day per employee
        if (!diaMap[day]) diaMap[day] = 0;
      }
    });
    // Recalculate per day
    const dayEmployeeMap: Record<string, Set<string>> = {};
    filtered.forEach((pf: any) => {
      const day = new Date(pf.producoes?.created_at).toLocaleDateString("pt-BR");
      if (!dayEmployeeMap[day]) dayEmployeeMap[day] = new Set();
      dayEmployeeMap[day].add(pf.funcionario_id);
    });
    const custoPorDia = Object.entries(dayEmployeeMap).map(([day, empSet]) => {
      let total = 0;
      empSet.forEach((eid) => {
        const f = funcMap[eid];
        if (f && f.tipo === "diaria") total += f.valor_pagamento;
      });
      return { name: day, valor: total };
    }).reverse();

    return { detalhes, totalGasto, totalDias, totalUnidades, custoPorDia, totalColaboradores: detalhes.length };
  }, [producaoFunc, funcionarios, startDate, endDate]);

  const periodoLabel = `${startDate?.toLocaleDateString("pt-BR") || "—"} a ${endDate?.toLocaleDateString("pt-BR") || "—"}`;

  const headers = ["Colaborador", "Tipo", "Dias Trabalhados", "Produções", "Unidades", "Valor Base", "Custo Total"];
  const rows = dados.detalhes.map((d) => [
    d.nome,
    d.tipo === "diaria" ? "Diária" : "Fixo",
    d.diasTrabalhados.toString(),
    d.producoes.toString(),
    d.unidades.toLocaleString("pt-BR"),
    `R$ ${d.valorBase.toFixed(2)}`,
    `R$ ${d.custo.toFixed(2)}`,
  ]);

  // Pie chart data
  const pieData = dados.detalhes.filter(d => d.custo > 0).slice(0, 6).map(d => ({
    name: d.nome,
    value: d.custo,
  }));

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <ExportButtons
          onPreview={() => setPreviewLoaded(true)}
          previewLoaded={previewLoaded}
          onPDF={() => exportToPDF("Relatório de Colaboradores", headers, rows, "relatorio-colaboradores", [
            { label: "Gasto Total", value: `R$ ${dados.totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total Colaboradores", value: dados.totalColaboradores.toString() },
            { label: "Total Dias Trabalhados", value: dados.totalDias.toString() },
            { label: "Unidades Produzidas", value: dados.totalUnidades.toLocaleString("pt-BR") },
            { label: "Período", value: periodoLabel },
          ], "charts-colaboradores", { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl })}
          onExcel={() => exportToExcel(headers, rows, "Colaboradores", "relatorio-colaboradores")}
        />
      </DateRangeFilter>

      {!previewLoaded ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Selecione os filtros e clique em "Visualizar Relatório"</p>
            <p className="text-sm mt-1">A pré-visualização será exibida aqui.</p>
          </CardContent>
        </Card>
      ) : dados.detalhes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">Não há dados de colaboradores no período selecionado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground font-medium">Período: {periodoLabel}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Gasto Total" value={`R$ ${dados.totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
            <KpiCard title="Colaboradores" value={dados.totalColaboradores.toString()} icon={Users} />
            <KpiCard title="Total Dias Trabalhados" value={dados.totalDias.toString()} icon={Calendar} />
            <KpiCard title="Unidades Produzidas" value={dados.totalUnidades.toLocaleString("pt-BR")} icon={TrendingUp} />
          </div>

          <div id="charts-colaboradores" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-chart-export>
                <CardHeader><CardTitle className="text-sm">Custo Diário (Diaristas)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dados.custoPorDia}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis />
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                      <Bar dataKey="valor" name="Custo" fill="hsl(200,98%,39%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card data-chart-export>
                <CardHeader><CardTitle className="text-sm">Distribuição por Colaborador</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Detalhamento por Colaborador</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {dados.detalhes.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.nome}</TableCell>
                      <TableCell>
                        <Badge variant={d.tipo === "diaria" ? "secondary" : "outline"}>
                          {d.tipo === "diaria" ? "Diária" : "Fixo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.diasTrabalhados}</TableCell>
                      <TableCell>{d.producoes}</TableCell>
                      <TableCell>{d.unidades.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>R$ {d.valorBase.toFixed(2)}</TableCell>
                      <TableCell className="font-bold">R$ {d.custo.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell />
                    <TableCell>{dados.totalDias}</TableCell>
                    <TableCell>{dados.detalhes.reduce((s, d) => s + d.producoes, 0)}</TableCell>
                    <TableCell>{dados.totalUnidades.toLocaleString("pt-BR")}</TableCell>
                    <TableCell />
                    <TableCell>R$ {dados.totalGasto.toFixed(2)}</TableCell>
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
