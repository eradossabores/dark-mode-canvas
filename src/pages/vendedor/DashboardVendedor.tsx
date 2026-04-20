import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy, Medal, UserPlus, Target, TrendingUp, TrendingDown, DollarSign, Users,
  Sparkles, AlertTriangle, Flame, Award, MapPin, Phone, Plus, ClipboardList,
  CalendarClock, ArrowUpRight, ArrowDownRight, PieChart as PieIcon, Activity,
} from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, format,
  differenceInDays, getDate, getDaysInMonth, eachDayOfInterval, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { motion } from "framer-motion";

interface ClienteRank {
  id: string;
  nome: string;
  telefone?: string;
  totalGasto: number;
  totalUnidades: number;
  vendas: number;
  ticketMedio: number;
}

interface ClienteAlerta {
  id: string;
  nome: string;
  telefone?: string;
  ultima_compra: string | null;
  diasSemComprar: number;
  status: "inativo" | "risco" | "ok";
  consumoMedio?: number;
  consumoRecente?: number;
}

interface Conquista {
  id: string;
  label: string;
  desc: string;
  unlocked: boolean;
  icon: any;
}

const FLAVOR_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(174 50% 45%)",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(38 90% 55%)",
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcularBonus(unidades: number) {
  if (unidades >= 2000) return 100;
  if (unidades >= 1000) return 50;
  return 0;
}

function whatsappLink(tel?: string, msg = "") {
  if (!tel) return "#";
  const num = tel.replace(/\D/g, "");
  const full = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

export default function DashboardVendedor() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");

  // KPIs
  const [unidadesMes, setUnidadesMes] = useState(0);
  const [valorMes, setValorMes] = useState(0);
  const [unidadesMesAnterior, setUnidadesMesAnterior] = useState(0);
  const [valorMesAnterior, setValorMesAnterior] = useState(0);
  const [comissaoPaga, setComissaoPaga] = useState(0);
  const [comissaoPendente, setComissaoPendente] = useState(0);
  const [inadimplencia, setInadimplencia] = useState(0);

  // Listas
  const [novosClientesSemana, setNovosClientesSemana] = useState<any[]>([]);
  const [novosMesAnterior, setNovosMesAnterior] = useState(0);
  const [ranking, setRanking] = useState<ClienteRank[]>([]);
  const [clientesAlertas, setClientesAlertas] = useState<ClienteAlerta[]>([]);
  const [meusClientes, setMeusClientes] = useState<any[]>([]);

  // Gráficos
  const [vendasDiarias, setVendasDiarias] = useState<{ dia: string; valor: number; unidades: number }[]>([]);
  const [mixSabores, setMixSabores] = useState<{ nome: string; valor: number }[]>([]);
  const [heatmap, setHeatmap] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  // Streak
  const [streak, setStreak] = useState(0);

  async function load() {
    if (!user) return;
    setLoading(true);

    const hoje = new Date();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const inicioMesAnt = startOfMonth(subMonths(hoje, 1));
    const fimMesAnt = endOfMonth(subMonths(hoje, 1));
    const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
    const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 });
    const ha30 = subDays(hoje, 30);
    const ha60 = subDays(hoje, 60);

    // Profile
    const { data: prof } = await (supabase as any).from("profiles").select("nome").eq("id", user.id).maybeSingle();
    setNome(prof?.nome || "");

    // Vínculos
    const { data: vinculos } = await (supabase as any)
      .from("cliente_vendedor")
      .select("cliente_id, created_at, clientes(id, nome, telefone, ultima_compra, latitude, longitude, status)")
      .eq("vendedor_user_id", user.id);

    const ids: string[] = (vinculos || []).map((v: any) => v.cliente_id);
    const clientesMap: Record<string, any> = {};
    (vinculos || []).forEach((v: any) => { if (v.clientes) clientesMap[v.cliente_id] = { ...v.clientes, vinculo_at: v.created_at }; });
    setMeusClientes(Object.values(clientesMap));

    // Novos da semana
    const novos = (vinculos || [])
      .filter((v: any) => new Date(v.created_at) >= inicioSemana && new Date(v.created_at) <= fimSemana)
      .map((v: any) => ({ id: v.cliente_id, nome: v.clientes?.nome || "—", telefone: v.clientes?.telefone, created_at: v.created_at }));
    setNovosClientesSemana(novos);

    const novosAnt = (vinculos || []).filter((v: any) =>
      new Date(v.created_at) >= inicioMesAnt && new Date(v.created_at) <= fimMesAnt
    ).length;
    setNovosMesAnterior(novosAnt);

    // Vendas
    let totalUnid = 0, totalValor = 0, totalUnidAnt = 0, totalValorAnt = 0;
    const mapRank: Record<string, ClienteRank> = {};
    const diasMap: Record<string, { valor: number; unidades: number }> = {};
    const saborMap: Record<string, { nome: string; valor: number }> = {};
    const heat = [0, 0, 0, 0, 0, 0, 0];
    const consumoRecente: Record<string, number> = {};
    const consumoAnterior: Record<string, number> = {};
    const datasComVenda = new Set<string>();

    if (ids.length > 0) {
      // Mês atual + dias para gráfico (últimos 30d)
      const inicioRange = ha60 < inicioMes ? ha60 : inicioMes;
      const { data: vendas } = await (supabase as any)
        .from("vendas")
        .select("id, total, cliente_id, status, created_at, clientes(id, nome, telefone), venda_itens(quantidade, subtotal, sabores(nome))")
        .in("cliente_id", ids)
        .gte("created_at", inicioRange.toISOString())
        .lte("created_at", fimMes.toISOString());

      (vendas || []).forEach((v: any) => {
        const dt = new Date(v.created_at);
        const qtd = (v.venda_itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
        const val = Number(v.total || 0);
        const ehMesAtual = dt >= inicioMes && dt <= fimMes;

        if (ehMesAtual) {
          totalUnid += qtd; totalValor += val;
          datasComVenda.add(format(dt, "yyyy-MM-dd"));
          heat[dt.getDay()] += qtd;

          const cid = v.cliente_id;
          const c = v.clientes || {};
          if (!mapRank[cid]) mapRank[cid] = { id: cid, nome: c.nome || "—", telefone: c.telefone, totalGasto: 0, totalUnidades: 0, vendas: 0, ticketMedio: 0 };
          mapRank[cid].totalGasto += val;
          mapRank[cid].totalUnidades += qtd;
          mapRank[cid].vendas += 1;

          (v.venda_itens || []).forEach((it: any) => {
            const nm = it.sabores?.nome || "Outros";
            if (!saborMap[nm]) saborMap[nm] = { nome: nm, valor: 0 };
            saborMap[nm].valor += Number(it.quantidade || 0);
          });
        }

        // Últimos 30d para gráfico
        if (dt >= ha30) {
          const k = format(dt, "yyyy-MM-dd");
          if (!diasMap[k]) diasMap[k] = { valor: 0, unidades: 0 };
          diasMap[k].valor += val;
          diasMap[k].unidades += qtd;
        }

        // Consumo recente vs anterior por cliente (para risco)
        if (dt >= ha30) consumoRecente[v.cliente_id] = (consumoRecente[v.cliente_id] || 0) + qtd;
        else if (dt >= ha60) consumoAnterior[v.cliente_id] = (consumoAnterior[v.cliente_id] || 0) + qtd;

        // Inadimplência
        const st = String(v.status || "").toLowerCase();
        if (ehMesAtual && (st === "pendente" || st === "parcial")) {
          // só estima saldo (não temos abatimentos aqui)
        }
      });

      // Mês anterior
      const { data: vendasAnt } = await (supabase as any)
        .from("vendas")
        .select("total, venda_itens(quantidade)")
        .in("cliente_id", ids)
        .gte("created_at", inicioMesAnt.toISOString())
        .lte("created_at", fimMesAnt.toISOString());
      (vendasAnt || []).forEach((v: any) => {
        totalValorAnt += Number(v.total || 0);
        totalUnidAnt += (v.venda_itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
      });

      // Inadimplência (saldo aberto agregado dos clientes)
      const { data: aReceber } = await (supabase as any)
        .from("vendas")
        .select("total, id, cliente_id, abatimentos_historico(valor)")
        .in("cliente_id", ids);
      let saldoAberto = 0;
      (aReceber || []).forEach((v: any) => {
        const pago = (v.abatimentos_historico || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
        const dif = Number(v.total || 0) - pago;
        if (dif > 0.5) saldoAberto += dif;
      });
      setInadimplencia(saldoAberto);
    }

    setUnidadesMes(totalUnid); setValorMes(totalValor);
    setUnidadesMesAnterior(totalUnidAnt); setValorMesAnterior(totalValorAnt);

    // Ranking com ticket médio
    const rk = Object.values(mapRank).map(r => ({ ...r, ticketMedio: r.vendas > 0 ? r.totalGasto / r.vendas : 0 }))
      .sort((a, b) => b.totalUnidades - a.totalUnidades).slice(0, 5);
    setRanking(rk);

    // Mix sabores top 6
    const mix = Object.values(saborMap).sort((a, b) => b.valor - a.valor).slice(0, 6);
    setMixSabores(mix);

    // Heatmap
    setHeatmap(heat);

    // Vendas diárias (30d)
    const dias30 = eachDayOfInterval({ start: ha30, end: hoje });
    setVendasDiarias(dias30.map(d => {
      const k = format(d, "yyyy-MM-dd");
      return { dia: format(d, "dd/MM"), valor: diasMap[k]?.valor || 0, unidades: diasMap[k]?.unidades || 0 };
    }));

    // Streak (dias consecutivos com venda terminando hoje ou ontem)
    let s = 0;
    let cursor = new Date(hoje);
    while (datasComVenda.has(format(cursor, "yyyy-MM-dd"))) { s++; cursor = subDays(cursor, 1); }
    if (s === 0 && datasComVenda.has(format(subDays(hoje, 1), "yyyy-MM-dd"))) {
      cursor = subDays(hoje, 1);
      while (datasComVenda.has(format(cursor, "yyyy-MM-dd"))) { s++; cursor = subDays(cursor, 1); }
    }
    setStreak(s);

    // Alertas de clientes
    const alertas: ClienteAlerta[] = [];
    Object.values(clientesMap).forEach((c: any) => {
      const ult = c.ultima_compra ? new Date(c.ultima_compra) : null;
      const diasSem = ult ? differenceInDays(hoje, ult) : 9999;
      const recente = consumoRecente[c.id] || 0;
      const anterior = consumoAnterior[c.id] || 0;
      const queda = anterior > 0 ? ((anterior - recente) / anterior) * 100 : 0;
      let status: "inativo" | "risco" | "ok" = "ok";
      if (diasSem >= 30) status = "inativo";
      else if (queda >= 50 && anterior >= 5) status = "risco";
      if (status !== "ok") {
        alertas.push({ id: c.id, nome: c.nome, telefone: c.telefone, ultima_compra: c.ultima_compra,
          diasSemComprar: diasSem, status, consumoMedio: anterior, consumoRecente: recente });
      }
    });
    alertas.sort((a, b) => b.diasSemComprar - a.diasSemComprar);
    setClientesAlertas(alertas.slice(0, 8));

    // Comissões
    const { data: com } = await (supabase as any)
      .from("comissoes_vendas")
      .select("valor_comissao, status, created_at")
      .eq("vendedor_user_id", user.id)
      .gte("created_at", inicioMes.toISOString())
      .lte("created_at", fimMes.toISOString());
    let cP = 0, cPend = 0;
    (com || []).forEach((c: any) => {
      const v = Number(c.valor_comissao || 0);
      if (String(c.status).toLowerCase() === "pago" || String(c.status).toLowerCase() === "paga") cP += v;
      else cPend += v;
    });
    setComissaoPaga(cP); setComissaoPendente(cPend);

    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  const bonus = calcularBonus(unidadesMes);
  const proximaMeta = unidadesMes >= 2000 ? null : (unidadesMes >= 1000 ? 2000 : 1000);
  const progresso = proximaMeta ? Math.min(100, (unidadesMes / proximaMeta) * 100) : 100;
  const maxRank = ranking[0]?.totalUnidades || 1;

  // Variações
  const varUnid = unidadesMesAnterior > 0 ? ((unidadesMes - unidadesMesAnterior) / unidadesMesAnterior) * 100 : (unidadesMes > 0 ? 100 : 0);
  const varValor = valorMesAnterior > 0 ? ((valorMes - valorMesAnterior) / valorMesAnterior) * 100 : (valorMes > 0 ? 100 : 0);
  const varNovos = novosMesAnterior > 0 ? ((novosClientesSemana.length - novosMesAnterior) / novosMesAnterior) * 100 : 0;

  // Projeção
  const diaAtual = getDate(new Date());
  const diasNoMes = getDaysInMonth(new Date());
  const projecaoUnid = diaAtual > 0 ? Math.round((unidadesMes / diaAtual) * diasNoMes) : 0;
  const projecaoValor = diaAtual > 0 ? (valorMes / diaAtual) * diasNoMes : 0;

  // Conquistas
  const conquistas: Conquista[] = useMemo(() => [
    { id: "c1", label: "Primeiro Cliente", desc: "Cadastre 1 cliente", unlocked: meusClientes.length >= 1, icon: UserPlus },
    { id: "c2", label: "10 Clientes", desc: "Carteira em formação", unlocked: meusClientes.length >= 10, icon: Users },
    { id: "c3", label: "1.000 Unidades", desc: "Meta intermediária do mês", unlocked: unidadesMes >= 1000, icon: Target },
    { id: "c4", label: "2.000 Unidades", desc: "Meta máxima do mês", unlocked: unidadesMes >= 2000, icon: Trophy },
    { id: "c5", label: "R$ 10.000 vendidos", desc: "Faturamento mensal", unlocked: valorMes >= 10000, icon: DollarSign },
    { id: "c6", label: "Streak 7 dias", desc: "7 dias seguidos vendendo", unlocked: streak >= 7, icon: Flame },
  ], [meusClientes.length, unidadesMes, valorMes, streak]);

  const tarefasDoDia = clientesAlertas.slice(0, 3);
  const maxHeat = Math.max(...heatmap, 1);
  const faltaProxFaixa = useMemo(() => {
    if (unidadesMes < 100) return 100 - unidadesMes;
    if (unidadesMes < 200) return 200 - unidadesMes;
    if (unidadesMes < 300) return 300 - unidadesMes;
    if (unidadesMes < 400) return 400 - unidadesMes;
    return 0;
  }, [unidadesMes]);

  return (
    <div className="space-y-6 pb-24">
      {/* Welcome Banner com Lamp Effect (teal/cyan) */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-primary/20 bg-gradient-to-b from-background via-background to-primary/5">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0, width: "6rem" }}
            animate={{ opacity: 0.45, width: "22rem" }}
            transition={{ delay: 0.1, duration: 1.2, ease: "easeOut" }}
            style={{ backgroundImage: `conic-gradient(from 70deg at center top, hsl(174, 50%, 45%), transparent, transparent)` }}
            className="absolute -top-4 right-1/2 h-28"
          >
            <div className="absolute w-full left-0 bg-background/80 h-16 bottom-0 [mask-image:linear-gradient(to_top,white,transparent)]" />
            <div className="absolute w-16 h-full left-0 bg-background/80 bottom-0 [mask-image:linear-gradient(to_right,white,transparent)]" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, width: "6rem" }}
            animate={{ opacity: 0.45, width: "22rem" }}
            transition={{ delay: 0.1, duration: 1.2, ease: "easeOut" }}
            style={{ backgroundImage: `conic-gradient(from 290deg at center top, transparent, transparent, hsl(174, 50%, 45%))` }}
            className="absolute -top-4 left-1/2 h-28"
          >
            <div className="absolute w-16 h-full right-0 bg-background/80 bottom-0 [mask-image:linear-gradient(to_left,white,transparent)]" />
            <div className="absolute w-full right-0 bg-background/80 h-16 bottom-0 [mask-image:linear-gradient(to_top,white,transparent)]" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.25, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 rounded-full blur-3xl"
            style={{ background: "hsl(174, 45%, 45%)" }}
          />
          <motion.div
            initial={{ width: "4rem", opacity: 0 }}
            animate={{ width: "14rem", opacity: 0.6 }}
            transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px]"
            style={{ background: "linear-gradient(to right, transparent, hsl(174, 50%, 50%), transparent)" }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative z-20 px-4 py-4 sm:px-6 sm:py-6 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Olá<span className="text-primary">{nome ? `, ${nome.split(" ")[0]}` : ""}</span>! Bora vender?
              </h1>
              {streak >= 2 && (
                <Badge className="bg-accent/15 text-accent-foreground border border-accent/40 hover:bg-accent/20">
                  <Flame className="h-3 w-3 mr-1 text-accent" /> {streak} dias 🔥
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground pl-7">
              Resumo de {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })} · {faltaProxFaixa > 0 ? `Faltam ${faltaProxFaixa}un para próxima faixa de bônus!` : "Você está mandando muito bem! 🚀"}
            </p>
          </div>
          <div className="hidden md:flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/painel/vendedor/clientes">Meus Clientes</Link></Button>
            <Button asChild size="sm" className="shadow-md"><Link to="/painel/vendedor/novo-pedido"><Plus className="h-4 w-4 mr-1" />Novo Pedido</Link></Button>
          </div>
        </div>
      </div>

      {/* Alertas inteligentes */}
      {(faltaProxFaixa > 0 && faltaProxFaixa <= 30) || clientesAlertas.length > 0 || inadimplencia > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {faltaProxFaixa > 0 && faltaProxFaixa <= 30 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Target className="h-8 w-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Você está a {faltaProxFaixa}un da próxima faixa!</p>
                  <p className="text-xs text-muted-foreground">Comissão maior por pacote te espera.</p>
                </div>
              </CardContent>
            </Card>
          )}
          {clientesAlertas.length > 0 && (
            <Card className="border-red-500/40 bg-red-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{clientesAlertas.length} clientes precisam de atenção</p>
                  <p className="text-xs text-muted-foreground">Inativos ou com queda no consumo</p>
                </div>
              </CardContent>
            </Card>
          )}
          {inadimplencia > 0 && (
            <Card className="border-orange-500/40 bg-orange-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">R$ {inadimplencia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em aberto</p>
                  <p className="text-xs text-muted-foreground">Saldo da sua carteira</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* KPIs com variação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Unidades (mês)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unidadesMes}</p>
            <p className={`text-xs flex items-center gap-1 ${varUnid >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {varUnid >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {varUnid.toFixed(1)}% vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Faturamento</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {valorMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <p className={`text-xs flex items-center gap-1 ${varValor >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {varValor >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {varValor.toFixed(1)}% vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Projeção do mês</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{projecaoUnid} un</p>
            <p className="text-xs text-muted-foreground">≈ R$ {projecaoValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Comissão</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {(comissaoPaga + comissaoPendente).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-600">R$ {comissaoPaga.toFixed(2)} paga</span> ·{" "}
              <span className="text-amber-600">R$ {comissaoPendente.toFixed(2)} pend.</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Meta mensal */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Progresso da meta mensal</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{unidadesMes} unidades · Bônus atual: R$ {bonus.toFixed(2)}</span>
            <span className="text-muted-foreground">{proximaMeta ? `Próxima: ${proximaMeta} un.` : "Meta máxima atingida 🏆"}</span>
          </div>
          <Progress value={progresso} />
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>1.000 un = +R$ 50</span>
            <span>2.000 un = +R$ 100</span>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos: vendas diárias + mix sabores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Vendas dos últimos 30 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vendasDiarias}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="unidades" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Unidades" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PieIcon className="h-5 w-5 text-primary" /> Mix de sabores</CardTitle></CardHeader>
          <CardContent>
            {mixSabores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mixSabores} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={(e) => e.nome}>
                      {mixSabores.map((_, i) => <Cell key={i} fill={FLAVOR_COLORS[i % FLAVOR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Heatmap semanal + Conquistas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Vendas por dia da semana (mês)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {DIAS_SEMANA.map((d, i) => {
                const intensidade = heatmap[i] / maxHeat;
                return (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <div className="w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-all"
                      style={{ background: `hsl(var(--primary) / ${0.1 + intensidade * 0.7})`, color: intensidade > 0.4 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))" }}>
                      {heatmap[i]}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" /> Conquistas</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {conquistas.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.id} className={`rounded-lg border p-3 text-center transition-all ${c.unlocked ? "bg-amber-500/10 border-amber-500/40" : "bg-muted/30 border-border opacity-50"}`}>
                    <Icon className={`h-6 w-6 mx-auto mb-1 ${c.unlocked ? "text-amber-500" : "text-muted-foreground"}`} />
                    <p className="text-[11px] font-semibold leading-tight">{c.label}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight">{c.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cadastros + Tarefas do dia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Cadastros desta semana</span>
              <div className="flex items-center gap-2">
                {varNovos !== 0 && (
                  <Badge variant="outline" className={varNovos >= 0 ? "text-emerald-600 border-emerald-500/30" : "text-red-600 border-red-500/30"}>
                    {varNovos >= 0 ? "+" : ""}{varNovos.toFixed(0)}%
                  </Badge>
                )}
                <Badge variant="secondary">{novosClientesSemana.length}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
              : novosClientesSemana.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum cadastro nesta semana ainda.</p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/painel/vendedor/clientes">Cadastrar cliente</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto">
                  {novosClientesSemana.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/40 transition gap-2">
                      <span className="font-medium truncate">{c.nome}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "EEE dd/MM", { locale: ptBR })}</span>
                        {c.telefone && (
                          <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                            <a href={whatsappLink(c.telefone, `Olá ${c.nome.split(" ")[0]}, tudo bem?`)} target="_blank" rel="noreferrer">
                              <Phone className="h-3 w-3 text-emerald-600" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Tarefas sugeridas hoje</CardTitle></CardHeader>
          <CardContent>
            {tarefasDoDia.length === 0 ? (
              <div className="text-center py-6">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Tudo em dia! Nenhum cliente requer atenção.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tarefasDoDia.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.status === "inativo" ? `Sem comprar há ${c.diasSemComprar}d` : `Queda no consumo (${c.consumoMedio}→${c.consumoRecente})`}
                      </p>
                    </div>
                    {c.telefone && (
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <a href={whatsappLink(c.telefone, `Olá ${c.nome.split(" ")[0]}, tudo bem? Posso te ajudar com seu próximo pedido?`)} target="_blank" rel="noreferrer">
                          <Phone className="h-3 w-3 mr-1" /> Contatar
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking + Clientes em alerta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Top clientes (mais compraram)</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
              : ranking.length === 0 ? (
                <div className="text-center py-6">
                  <Trophy className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Sem vendas registradas no mês.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ranking.map((c, i) => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {i === 0 && <Medal className="h-4 w-4 text-amber-500 shrink-0" />}
                          {i === 1 && <Medal className="h-4 w-4 text-muted-foreground shrink-0" />}
                          {i === 2 && <Medal className="h-4 w-4 text-amber-700 shrink-0" />}
                          {i > 2 && <span className="w-4 text-center text-xs text-muted-foreground shrink-0">{i + 1}</span>}
                          <span className="font-medium truncate">{c.nome}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold">{c.totalUnidades} un</span>
                          <span className="text-[10px] text-muted-foreground ml-1">(R$ {c.totalGasto.toFixed(0)} · TM R$ {c.ticketMedio.toFixed(0)})</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${(c.totalUnidades / maxRank) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Clientes em alerta</span>
              <Badge variant="secondary">{clientesAlertas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientesAlertas.length === 0 ? (
              <div className="text-center py-6">
                <Sparkles className="h-10 w-10 mx-auto text-emerald-500/60 mb-2" />
                <p className="text-sm text-muted-foreground">Carteira saudável! 🎉</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-auto">
                {clientesAlertas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.status === "inativo" ? `Inativo há ${c.diasSemComprar === 9999 ? "∞" : c.diasSemComprar + "d"}` : "Queda de consumo"}
                      </p>
                    </div>
                    <Badge variant="outline" className={c.status === "inativo" ? "text-red-600 border-red-500/40" : "text-amber-600 border-amber-500/40"}>
                      {c.status === "inativo" ? "Inativo" : "Risco"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ação rápida flutuante */}
      <div className="fixed bottom-6 right-6 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" className="h-14 w-14 rounded-full shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild><Link to="/painel/vendedor/novo-pedido"><DollarSign className="h-4 w-4 mr-2" /> Novo Pedido</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/painel/vendedor/clientes"><UserPlus className="h-4 w-4 mr-2" /> Novo Cliente</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/painel/vendedor/comissoes"><Award className="h-4 w-4 mr-2" /> Minhas Comissões</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/painel/vendedor/estoque"><ClipboardList className="h-4 w-4 mr-2" /> Estoque Disponível</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
