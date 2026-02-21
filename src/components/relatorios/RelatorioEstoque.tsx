import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Warehouse, AlertTriangle, ArrowDownUp, Package } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";

export default function RelatorioEstoque() {
  const [gelos, setGelos] = useState<any[]>([]);
  const [materias, setMaterias] = useState<any[]>([]);
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [filtroTipo, setFiltroTipo] = useState("todos");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [g, m, e, mv] = await Promise.all([
      (supabase as any).from("estoque_gelos").select("*, sabores(nome)"),
      (supabase as any).from("materias_primas").select("*"),
      (supabase as any).from("embalagens").select("*"),
      (supabase as any).from("movimentacoes_estoque").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setGelos(g.data || []);
    setMaterias(m.data || []);
    setEmbalagens(e.data || []);
    setMovimentacoes(mv.data || []);
  }

  const filteredMov = useMemo(() => {
    return movimentacoes.filter((m) => {
      const d = new Date(m.created_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
      if (filtroTipo !== "todos" && m.tipo_movimentacao !== filtroTipo) return false;
      return true;
    });
  }, [movimentacoes, startDate, endDate, filtroTipo]);

  const totalGelos = gelos.reduce((s, g) => s + g.quantidade, 0);
  const baixoEstoqueMP = materias.filter((m) => m.estoque_atual <= m.estoque_minimo);
  const baixoEstoqueEmb = embalagens.filter((e) => e.estoque_atual <= e.estoque_minimo);
  const totalBaixo = baixoEstoqueMP.length + baixoEstoqueEmb.length;

  const entradas = filteredMov.filter((m) => m.tipo_movimentacao === "entrada").reduce((s, m) => s + Number(m.quantidade), 0);
  const saidas = filteredMov.filter((m) => m.tipo_movimentacao === "saida").reduce((s, m) => s + Number(m.quantidade), 0);

  const gelosPorSabor = gelos.map((g) => ({ name: g.sabores?.nome || "?", value: g.quantidade })).sort((a, b) => b.value - a.value);

  const movPorDia = useMemo(() => {
    const map: Record<string, { entrada: number; saida: number }> = {};
    filteredMov.forEach((m) => {
      const day = new Date(m.created_at).toLocaleDateString("pt-BR");
      if (!map[day]) map[day] = { entrada: 0, saida: 0 };
      map[day][m.tipo_movimentacao as "entrada" | "saida"] += Number(m.quantidade);
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).reverse();
  }, [filteredMov]);

  const movHeaders = ["Data", "Tipo Item", "Movimentação", "Quantidade", "Referência", "Operador"];
  const movRows = filteredMov.map((m) => [
    new Date(m.created_at).toLocaleDateString("pt-BR"),
    m.tipo_item,
    m.tipo_movimentacao,
    Number(m.quantidade),
    m.referencia || "-",
    m.operador,
  ]);

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <div>
          <Label className="text-xs mb-1 block">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ExportButtons
          onPDF={() => exportToPDF("Relatório de Estoque", movHeaders, movRows, "relatorio-estoque")}
          onExcel={() => exportToExcel(movHeaders, movRows, "Estoque", "relatorio-estoque")}
        />
      </DateRangeFilter>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Gelos em Estoque" value={totalGelos.toLocaleString("pt-BR")} icon={Package} subtitle="unidades" />
        <KpiCard title="Entradas (período)" value={entradas.toLocaleString("pt-BR")} icon={Warehouse} />
        <KpiCard title="Saídas (período)" value={saidas.toLocaleString("pt-BR")} icon={ArrowDownUp} />
        <KpiCard title="Itens com Estoque Baixo" value={totalBaixo.toString()} icon={AlertTriangle} subtitle={totalBaixo > 0 ? "Atenção!" : "OK"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Estoque de Gelos por Sabor</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={gelosPorSabor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="Qtd" fill="hsl(142,71%,45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Movimentações por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={movPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="entrada" name="Entradas" stroke="hsl(142,71%,45%)" strokeWidth={2} />
                <Line type="monotone" dataKey="saida" name="Saídas" stroke="hsl(0,72%,50%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {totalBaixo > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-destructive">⚠ Itens com Estoque Baixo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Atual</TableHead>
                  <TableHead>Mínimo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baixoEstoqueMP.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.nome}</TableCell>
                    <TableCell>Matéria-prima</TableCell>
                    <TableCell className="text-destructive font-semibold">{m.estoque_atual}</TableCell>
                    <TableCell>{m.estoque_minimo}</TableCell>
                  </TableRow>
                ))}
                {baixoEstoqueEmb.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.nome}</TableCell>
                    <TableCell>Embalagem</TableCell>
                    <TableCell className="text-destructive font-semibold">{e.estoque_atual}</TableCell>
                    <TableCell>{e.estoque_minimo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Movimentações Detalhadas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>{movHeaders.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {filteredMov.slice(0, 100).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="capitalize">{m.tipo_item.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo_movimentacao === "entrada" ? "default" : "destructive"}>{m.tipo_movimentacao}</Badge>
                  </TableCell>
                  <TableCell>{Number(m.quantidade)}</TableCell>
                  <TableCell className="capitalize">{m.referencia || "-"}</TableCell>
                  <TableCell>{m.operador}</TableCell>
                </TableRow>
              ))}
              {filteredMov.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma movimentação.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
