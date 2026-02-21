import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Factory, Package, Users, TrendingUp } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";

const COLORS = ["hsl(200,98%,39%)", "hsl(213,93%,67%)", "hsl(215,20%,65%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(0,72%,50%)"];

export default function RelatorioProducao() {
  const [producoes, setProducoes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [prodFuncs, setProdFuncs] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [filtroSabor, setFiltroSabor] = useState("todos");
  const [filtroResp, setFiltroResp] = useState("todos");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [p, s, f, pf] = await Promise.all([
      (supabase as any).from("producoes").select("*, sabores(nome)").order("created_at", { ascending: false }),
      (supabase as any).from("sabores").select("id, nome"),
      (supabase as any).from("funcionarios").select("id, nome"),
      (supabase as any).from("producao_funcionarios").select("*, funcionarios(nome)"),
    ]);
    setProducoes(p.data || []);
    setSabores(s.data || []);
    setFuncionarios(f.data || []);
    setProdFuncs(pf.data || []);
  }

  const filtered = useMemo(() => {
    return producoes.filter((p) => {
      const d = new Date(p.created_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
      if (filtroSabor !== "todos" && p.sabor_id !== filtroSabor) return false;
      if (filtroResp !== "todos") {
        const funcs = prodFuncs.filter((pf) => pf.producao_id === p.id);
        if (!funcs.some((f) => f.funcionario_id === filtroResp)) return false;
      }
      return true;
    });
  }, [producoes, startDate, endDate, filtroSabor, filtroResp, prodFuncs]);

  const totalProduzido = filtered.reduce((s, p) => s + p.quantidade_total, 0);
  const totalLotes = filtered.reduce((s, p) => s + p.quantidade_lotes, 0);

  const porSabor = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((p) => {
      const nome = p.sabores?.nome || "?";
      map[nome] = (map[nome] || 0) + p.quantidade_total;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const porResponsavel = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((p) => {
      const funcs = prodFuncs.filter((pf) => pf.producao_id === p.id);
      funcs.forEach((f) => {
        const nome = f.funcionarios?.nome || "?";
        map[nome] = (map[nome] || 0) + 1;
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered, prodFuncs]);

  const headers = ["Data", "Sabor", "Modo", "Lotes", "Total", "Operador"];
  const rows = filtered.map((p) => [
    new Date(p.created_at).toLocaleDateString("pt-BR"),
    p.sabores?.nome || "-",
    p.modo,
    p.quantidade_lotes,
    p.quantidade_total,
    p.operador,
  ]);

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <div>
          <Label className="text-xs mb-1 block">Sabor</Label>
          <Select value={filtroSabor} onValueChange={setFiltroSabor}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Responsável</Label>
          <Select value={filtroResp} onValueChange={setFiltroResp}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ExportButtons
          onPDF={() => exportToPDF("Relatório de Produção", headers, rows, "relatorio-producao")}
          onExcel={() => exportToExcel(headers, rows, "Produção", "relatorio-producao")}
        />
      </DateRangeFilter>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Produzido" value={totalProduzido.toLocaleString("pt-BR")} icon={Package} subtitle="unidades" />
        <KpiCard title="Total de Lotes" value={totalLotes.toLocaleString("pt-BR")} icon={Factory} />
        <KpiCard title="Produções Registradas" value={filtered.length.toString()} icon={TrendingUp} />
        <KpiCard title="Média por Produção" value={filtered.length ? Math.round(totalProduzido / filtered.length).toString() : "0"} icon={Users} subtitle="unidades" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Produção por Sabor</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porSabor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="Qtd" fill="hsl(200,98%,39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Produções por Responsável</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={porResponsavel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {porResponsavel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Histórico de Produções</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h) => <TableHead key={h}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{p.sabores?.nome}</TableCell>
                  <TableCell className="capitalize">{p.modo}</TableCell>
                  <TableCell>{p.quantidade_lotes}</TableCell>
                  <TableCell>{p.quantidade_total}</TableCell>
                  <TableCell>{p.operador}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum dado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
