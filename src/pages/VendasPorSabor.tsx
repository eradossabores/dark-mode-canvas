import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IceCream, TrendingUp, CalendarRange, Factory, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

/** Cores do gráfico — mantidas em sincronia com o Painel de Vendas. */
const CHART_COLORS = [
  "hsl(262 83% 58%)",
  "hsl(173 58% 49%)",
  "hsl(43 96% 56%)",
  "hsl(280 65% 70%)",
  "hsl(160 60% 65%)",
  "hsl(340 75% 60%)",
  "hsl(200 80% 55%)",
  "hsl(30 90% 60%)",
];

type PeriodoPreset = "4semanas" | "8semanas" | "12semanas" | "26semanas" | "ano" | "custom";

interface ItemVenda {
  quantidade: number;
  sabor_id: string;
  sabores: { nome: string } | null;
  vendas: { created_at: string; status: string; clientes: { nome: string } | null } | null;
}

/** Evita o parsing pesado do literal de select pelo supabase-js. */
const sel = (s: string): string => s;

/** Retorna a segunda-feira (00:00 local) da semana da data informada. */
function inicioSemana(d: Date): Date {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = base.getDay(); // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  base.setDate(base.getDate() + diff);
  return base;
}

function fmtData(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function toInputDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

export default function VendasPorSabor() {
  const { factoryId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [preset, setPreset] = useState<PeriodoPreset>("8semanas");
  const [dataInicio, setDataInicio] = useState(() => toInputDate(inicioSemana(new Date())));
  const [dataFim, setDataFim] = useState(() => toInputDate(new Date()));
  const [saborFiltro, setSaborFiltro] = useState<string>("todos");
  const [margem, setMargem] = useState(10);

  useEffect(() => {
    document.title = "Vendas por Sabor | Planejamento de Produção";
  }, []);

  // Intervalo efetivo do filtro
  const { inicio, fim } = useMemo(() => {
    const hoje = new Date();
    if (preset === "custom") {
      const i = dataInicio ? new Date(`${dataInicio}T00:00:00`) : inicioSemana(hoje);
      const f = dataFim ? new Date(`${dataFim}T23:59:59`) : hoje;
      return { inicio: i, fim: f };
    }
    if (preset === "ano") {
      return { inicio: new Date(hoje.getFullYear(), 0, 1), fim: hoje };
    }
    const semanas = Number(preset.replace("semanas", "")) || 8;
    const i = inicioSemana(hoje);
    i.setDate(i.getDate() - (semanas - 1) * 7);
    return { inicio: i, fim: hoje };
  }, [preset, dataInicio, dataFim]);

  useEffect(() => {
    loadItens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryId, inicio.getTime(), fim.getTime()]);

  async function loadItens() {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("venda_itens")
        .select(sel("quantidade, sabor_id, sabores(nome), vendas!inner(created_at, status, clientes(nome))"))
        .gte("vendas.created_at", inicio.toISOString())
        .lte("vendas.created_at", fim.toISOString())
        .neq("vendas.status", "cancelada")
        .limit(20000);
      if (factoryId) q = q.eq("factory_id", factoryId);
      const { data, error } = await q;
      if (error) throw error;
      setItens((data || []) as ItemVenda[]);
    } catch (e: any) {
      console.error("Erro ao carregar vendas por sabor:", e);
      toast.error("Não foi possível carregar as vendas por sabor.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

  const sabores = useMemo(() => {
    const set = new Map<string, string>();
    itens.forEach((i) => set.set(i.sabor_id, i.sabores?.nome || "Sem sabor"));
    return Array.from(set.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itens]);

  const itensFiltrados = useMemo(
    () => (saborFiltro === "todos" ? itens : itens.filter((i) => i.sabor_id === saborFiltro)),
    [itens, saborFiltro],
  );

  /** Agrupamento por semana (segunda a domingo). */
  const semanas = useMemo(() => {
    const map = new Map<string, { inicio: Date; total: number; porSabor: Record<string, number> }>();
    itensFiltrados.forEach((it) => {
      if (!it.vendas?.created_at) return;
      const ini = inicioSemana(new Date(it.vendas.created_at));
      const key = toInputDate(ini);
      if (!map.has(key)) map.set(key, { inicio: ini, total: 0, porSabor: {} });
      const bucket = map.get(key)!;
      const nome = it.sabores?.nome || "Sem sabor";
      bucket.total += it.quantidade;
      bucket.porSabor[nome] = (bucket.porSabor[nome] || 0) + it.quantidade;
    });
    return Array.from(map.values())
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      .map((s) => {
        const fimSemana = new Date(s.inicio);
        fimSemana.setDate(fimSemana.getDate() + 6);
        return {
          ...s,
          label: `${fmtData(s.inicio)}–${fmtData(fimSemana)}`,
        };
      });
  }, [itensFiltrados]);

  /** Agrupamento por mês. */
  const meses = useMemo(() => {
    const map = new Map<string, { label: string; total: number; ordem: number }>();
    itensFiltrados.forEach((it) => {
      if (!it.vendas?.created_at) return;
      const d = new Date(it.vendas.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, {
          label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          total: 0,
          ordem: d.getFullYear() * 12 + d.getMonth(),
        });
      }
      map.get(key)!.total += it.quantidade;
    });
    return Array.from(map.values()).sort((a, b) => a.ordem - b.ordem);
  }, [itensFiltrados]);

  /** Totais por sabor + média semanal + sugestão de produção. */
  const porSabor = useMemo(() => {
    const map = new Map<string, number>();
    itensFiltrados.forEach((it) => {
      const nome = it.sabores?.nome || "Sem sabor";
      map.set(nome, (map.get(nome) || 0) + it.quantidade);
    });
    const nSemanas = Math.max(semanas.length, 1);
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(map.entries())
      .map(([nome, qtd]) => {
        const mediaSemanal = qtd / nSemanas;
        return {
          nome,
          total: qtd,
          participacao: (qtd / total) * 100,
          mediaSemanal,
          sugestao: Math.ceil((mediaSemanal * (1 + margem / 100)) / 10) * 10,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [itensFiltrados, semanas.length, margem]);

  /** Totais por cliente, com detalhamento por sabor. */
  const porCliente = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; porSabor: Record<string, number> }>();
    itensFiltrados.forEach((it) => {
      const nome = it.vendas?.clientes?.nome || "Sem cliente";
      if (!map.has(nome)) map.set(nome, { nome, total: 0, porSabor: {} });
      const b = map.get(nome)!;
      const sab = it.sabores?.nome || "Sem sabor";
      b.total += it.quantidade;
      b.porSabor[sab] = (b.porSabor[sab] || 0) + it.quantidade;
    });
    const total = Array.from(map.values()).reduce((s, c) => s + c.total, 0) || 1;
    return Array.from(map.values())
      .map((c) => ({ ...c, participacao: (c.total / total) * 100 }))
      .sort((a, b) => b.total - a.total);
  }, [itensFiltrados]);

  const totalUnidades = porSabor.reduce((s, p) => s + p.total, 0);
  const mediaSemanalGeral = semanas.length ? totalUnidades / semanas.length : 0;
  const ultimaSemana = semanas.length ? semanas[semanas.length - 1].total : 0;
  const penultimaSemana = semanas.length > 1 ? semanas[semanas.length - 2].total : 0;
  const variacao = penultimaSemana > 0 ? ((ultimaSemana - penultimaSemana) / penultimaSemana) * 100 : 0;

  const topNomes = porSabor.slice(0, 5).map((p) => p.nome);
  const chartSemanas = semanas.map((s) => {
    const row: Record<string, any> = { semana: s.label, Total: s.total };
    topNomes.forEach((n) => {
      row[n] = s.porSabor[n] || 0;
    });
    return row;
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <IceCream className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendas por Sabor</h1>
          <p className="text-sm text-muted-foreground">
            Quantos gelos você vende por semana e de quais sabores — base para planejar a produção.
          </p>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              { v: "4semanas", l: "4 semanas" },
              { v: "8semanas", l: "8 semanas" },
              { v: "12semanas", l: "12 semanas" },
              { v: "26semanas", l: "6 meses" },
              { v: "ano", l: "Ano atual" },
              { v: "custom", l: "Personalizado" },
            ] as { v: PeriodoPreset; l: string }[]).map(({ v, l }) => (
              <Button
                key={v}
                size="sm"
                variant={preset === v ? "default" : "outline"}
                onClick={() => setPreset(v)}
              >
                {l}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {preset === "custom" && (
              <>
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Sabor</Label>
              <Select value={saborFiltro} onValueChange={setSaborFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os sabores</SelectItem>
                  {sabores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Margem de segurança da produção (%)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={margem}
                onChange={(e) => setMargem(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Período analisado: {inicio.toLocaleDateString("pt-BR")} a {fim.toLocaleDateString("pt-BR")} ·{" "}
            {semanas.length} semana(s)
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando vendas...
        </div>
      ) : totalUnidades === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma venda encontrada no período selecionado.
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total vendido</p>
              <p className="text-2xl font-bold">{totalUnidades.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">unidades no período</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Média por semana</p>
              <p className="text-2xl font-bold text-primary">
                {Math.round(mediaSemanalGeral).toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-muted-foreground">unidades/semana</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Última semana</p>
              <p className="text-2xl font-bold">{ultimaSemana.toLocaleString("pt-BR")}</p>
              <p className={`text-xs flex items-center gap-1 ${variacao >= 0 ? "text-primary" : "text-destructive"}`}>
                <TrendingUp className="h-3 w-3" />
                {variacao >= 0 ? "+" : ""}{variacao.toFixed(1)}% vs. anterior
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Sabor líder</p>
              <p className="text-lg font-bold truncate">{porSabor[0]?.nome}</p>
              <p className="text-xs text-muted-foreground">
                {porSabor[0]?.participacao.toFixed(1)}% das vendas
              </p>
            </CardContent></Card>
          </div>

          {/* Semanal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Unidades vendidas por semana (top 5 sabores)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartSemanas}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, n: string) => [`${v} un.`, n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {topNomes.map((n, i) => (
                    <Bar key={n} dataKey={n} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Mensal */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Unidades vendidas por mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={meses}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v} un.`, "Unidades"]} />
                    <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Participação por sabor */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Participação por sabor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={porSabor.slice(0, 8)} dataKey="total" nameKey="nome" outerRadius={95} label={false}>
                      {porSabor.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [`${v} un.`, n]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Plano de produção sugerido */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Factory className="h-4 w-4" /> Produção semanal sugerida (média + {margem}% de margem)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sabor</TableHead>
                    <TableHead className="text-right">Total período</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Média/semana</TableHead>
                    <TableHead className="text-right">Produzir/semana</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porSabor.map((s, i) => (
                    <TableRow key={s.nome}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {s.nome}
                      </TableCell>
                      <TableCell className="text-right">{s.total.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {s.participacao.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">{Math.round(s.mediaSemanal).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-bold">
                          {s.sugestao.toLocaleString("pt-BR")} un.
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Clientes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Clientes que compraram {saborFiltro === "todos" ? "no período" : "este sabor"}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    {topNomes.map((n) => (
                      <TableHead key={n} className="text-right whitespace-nowrap">{n}</TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porCliente.map((c) => (
                    <TableRow key={c.nome}>
                      <TableCell className="font-medium whitespace-nowrap">{c.nome}</TableCell>
                      {topNomes.map((n) => (
                        <TableCell key={n} className="text-right">
                          {(c.porSabor[n] || 0).toLocaleString("pt-BR")}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">{c.total.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.participacao.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detalhe semana a semana */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalhe semana a semana</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    {topNomes.map((n) => (
                      <TableHead key={n} className="text-right">{n}</TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...semanas].reverse().map((s) => (
                    <TableRow key={s.label}>
                      <TableCell className="font-medium whitespace-nowrap">{s.label}</TableCell>
                      {topNomes.map((n) => (
                        <TableCell key={n} className="text-right">
                          {(s.porSabor[n] || 0).toLocaleString("pt-BR")}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">{s.total.toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
