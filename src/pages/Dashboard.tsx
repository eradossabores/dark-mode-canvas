import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, Factory, Users, AlertTriangle, TrendingUp, DollarSign, Bell, Sparkles } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { motion } from "framer-motion";
import { GradientDots } from "@/components/ui/gradient-dots";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import sidImg from "@/assets/sid.png";
import buckImg from "@/assets/buck.png";
import scrat3dImg from "@/assets/scrat-3d.png";
import scratAcornImg from "@/assets/scrat-acorn.png";
import scratStandingImg from "@/assets/scrat-standing.png";
import scratHangingImg from "@/assets/scrat-hanging.png";
import EstoqueInteligente from "@/components/dashboard/EstoqueInteligente";
import RankingClientes from "@/components/dashboard/RankingClientes";
import ClientesInativos from "@/components/dashboard/ClientesInativos";
import GastosColaboradores from "@/components/dashboard/GastosColaboradores";

const postItCharacters = [sidImg, scratAcornImg, buckImg, scrat3dImg, scratStandingImg, scratHangingImg];
const ERA_DOS_SABORES_ID = "00000000-0000-0000-0000-000000000001";

const CHART_COLORS = [
  "hsl(270, 60%, 50%)",
  "hsl(174, 50%, 45%)",
  "hsl(38, 90%, 55%)",
  "hsl(270, 40%, 65%)",
  "hsl(174, 35%, 60%)",
];

type PeriodoFiltro = "7dias" | "15dias" | "mensal";

const MESES_NOME = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getDaysForPeriod(periodo: PeriodoFiltro): number {
  if (periodo === "15dias") return 15;
  if (periodo === "mensal") return 30;
  return 7;
}

function getPeriodLabel(periodo: PeriodoFiltro, mesSelecionado?: number): string {
  if (periodo === "15dias") return "Últimos 15 dias";
  if (periodo === "mensal" && mesSelecionado !== undefined) return MESES_NOME[mesSelecionado];
  return "Últimos 7 dias";
}

function buildChartData(data: any[], days: number, dateKey: string, valueKey: string, isSum: boolean) {
  const start = new Date(); start.setDate(start.getDate() - (days - 1));
  const filtered = data.filter((item: any) => new Date(item[dateKey]) >= start);
  const map: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    map[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
  }
  filtered.forEach((item: any) => {
    const key = new Date(item[dateKey]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (map[key] !== undefined) map[key] += isSum ? Number(item[valueKey]) : item[valueKey];
  });
  return Object.entries(map).map(([dia, val]) => ({ dia, [isSum ? "valor" : "total"]: val }));
}

function buildMonthChartData(data: any[], month: number, year: number, dateKey: string, valueKey: string, isSum: boolean) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map: Record<string, number> = {};
  for (let i = 1; i <= daysInMonth; i++) {
    const key = `${String(i).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
    map[key] = 0;
  }
  data.forEach((item: any) => {
    const d = new Date(item[dateKey]);
    if (d.getMonth() === month && d.getFullYear() === year) {
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
      if (map[key] !== undefined) map[key] += isSum ? Number(item[valueKey]) : item[valueKey];
    }
  });
  return Object.entries(map).map(([dia, val]) => ({ dia, [isSum ? "valor" : "total"]: val }));
}

type ResumoPeriodo = "total" | "semanal" | "mensal" | "anual";

const RESUMO_PERIODOS: { value: ResumoPeriodo; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "semanal", label: "Semana" },
  { value: "mensal", label: "Mês" },
  { value: "anual", label: "Ano" },
];

function isWithinResumoPeriod(dateValue: string, periodo: ResumoPeriodo) {
  const data = new Date(dateValue);
  const now = new Date();

  if (periodo === "total") return true;
  if (periodo === "anual") return data.getFullYear() === now.getFullYear();
  if (periodo === "mensal") return data.getMonth() === now.getMonth() && data.getFullYear() === now.getFullYear();

  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - 7);
  return data >= inicioSemana;
}

function getResumoTitle(base: string, periodo: ResumoPeriodo) {
  if (periodo === "semanal") return `${base} · Semana`;
  if (periodo === "mensal") return `${base} · Mês`;
  if (periodo === "anual") return `${base} · Ano`;
  return `${base} · Total`;
}

// Motivational greetings per collaborator
const motivationalMessages = [
  { emoji: "🔥", text: "Hoje é dia de fazer acontecer! Cada gelo produzido é um cliente feliz." },
  { emoji: "💪", text: "Sua dedicação faz a diferença! Vamos bater mais um recorde?" },
  { emoji: "🚀", text: "O sucesso é construído um dia de cada vez. E hoje é mais um grande dia!" },
  { emoji: "⭐", text: "Você é peça fundamental nessa equipe! Continue brilhando!" },
  { emoji: "🎯", text: "Foco, força e gelo! Vamos conquistar mais um dia incrível!" },
  { emoji: "❄️", text: "Cada sabor que produzimos leva alegria pra alguém. Que orgulho!" },
  { emoji: "🏆", text: "Campeões se fazem no dia a dia. E você é um deles!" },
  { emoji: "✨", text: "A excelência mora nos detalhes. Continue caprichando!" },
  { emoji: "🌟", text: "Sua energia transforma o ambiente! Obrigado por estar aqui!" },
  { emoji: "💎", text: "Trabalho duro + paixão = resultados extraordinários!" },
  { emoji: "🎉", text: "Mais um dia pra mostrar do que somos capazes. Bora!" },
  { emoji: "🧊", text: "Refrescando o mundo, um gelo de cada vez. Orgulho da equipe!" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getDailyMessage(userId: string) {
  // Use date + userId to get a consistent but different message per user per day
  const today = new Date().toISOString().split("T")[0];
  let hash = 0;
  const seed = today + userId;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return motivationalMessages[Math.abs(hash) % motivationalMessages.length];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, factoryId } = useAuth();
  const isIceAgeFactory = factoryId === ERA_DOS_SABORES_ID;
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    totalGelos: 0, totalClientes: 0, totalVendas: 0,
    totalProducoes: 0, faturamento: 0, clientesInativos: 0,
    faturamentoSemanal: 0, faturamentoMensal: 0, faturamentoAnual: 0,
  });
  const [topSabores, setTopSabores] = useState<any[]>([]);
  const [vendasPorDia, setVendasPorDia] = useState<any[]>([]);
  const [producaoPorDia, setProducaoPorDia] = useState<any[]>([]);
  const [alertasEstoque, setAlertasEstoque] = useState<any[]>([]);
  const [alertaIndex, setAlertaIndex] = useState(0);
  const [showAllAlertas, setShowAllAlertas] = useState(false);
  const [contasReceber, setContasReceber] = useState({ total: 0, vencidas: 0, quantidade: 0 });
  const [periodoFaturamento, setPeriodoFaturamento] = useState<PeriodoFiltro>("7dias");
  const [periodoProducao, setPeriodoProducao] = useState<PeriodoFiltro>("7dias");
  const [mesFaturamento, setMesFaturamento] = useState(new Date().getMonth());
  const [mesProducao, setMesProducao] = useState(new Date().getMonth());
  const [allVendas, setAllVendas] = useState<any[]>([]);
  const [allProducoes, setAllProducoes] = useState<any[]>([]);
  const [fatPeriodo, setFatPeriodo] = useState<ResumoPeriodo>("total");
  const [vendasPeriodo, setVendasPeriodo] = useState<ResumoPeriodo>("total");
  const [producoesPeriodo, setProducoesPeriodo] = useState<ResumoPeriodo>("total");
  const [receberPeriodo, setReceberPeriodo] = useState<ResumoPeriodo>("total");
  useEffect(() => { loadStats(); loadUserName(); }, [factoryId]);

  async function loadUserName() {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();
    setUserName(data?.nome || user.email?.split("@")[0] || "Colaborador");
  }

  const dailyMessage = useMemo(() => {
    return getDailyMessage(user?.id || "default");
  }, [user?.id]);

  // Auto-rotate alerts every 5 seconds
  useEffect(() => {
    if (alertasEstoque.length <= 1) return;
    const interval = setInterval(() => {
      setAlertaIndex((prev) => (prev + 1) % alertasEstoque.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [alertasEstoque.length]);

  // Recalculate charts when period changes
  useEffect(() => {
    if (allVendas.length === 0) return;
    if (periodoFaturamento === "mensal") {
      setVendasPorDia(buildMonthChartData(allVendas, mesFaturamento, new Date().getFullYear(), "created_at", "total", true));
    } else {
      setVendasPorDia(buildChartData(allVendas, getDaysForPeriod(periodoFaturamento), "created_at", "total", true));
    }
  }, [periodoFaturamento, mesFaturamento, allVendas]);

  useEffect(() => {
    if (allProducoes.length === 0) return;
    if (periodoProducao === "mensal") {
      setProducaoPorDia(buildMonthChartData(allProducoes, mesProducao, new Date().getFullYear(), "created_at", "quantidade_total", false));
    } else {
      setProducaoPorDia(buildChartData(allProducoes, getDaysForPeriod(periodoProducao), "created_at", "quantidade_total", false));
    }
  }, [periodoProducao, mesProducao, allProducoes]);

  async function loadStats() {
    try {
      // Build queries with factory_id filter
      let gelosQuery = (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome)");
      let clientesQuery = (supabase as any).from("clientes").select("id").eq("status", "ativo");
      let vendasQuery = (supabase as any).from("vendas").select("total, created_at, status");
      let producoesQuery = (supabase as any).from("producoes").select("quantidade_total, created_at");
      let inativosQuery = (supabase as any).from("clientes").select("id").eq("status", "inativo");

      if (factoryId) {
        gelosQuery = gelosQuery.eq("factory_id", factoryId);
        clientesQuery = clientesQuery.eq("factory_id", factoryId);
        vendasQuery = vendasQuery.eq("factory_id", factoryId);
        producoesQuery = producoesQuery.eq("factory_id", factoryId);
        inativosQuery = inativosQuery.eq("factory_id", factoryId);
      }

      const [gelos, clientes, vendas, producoes, inativos] = await Promise.all([
        gelosQuery, clientesQuery, vendasQuery, producoesQuery, inativosQuery,
      ]);

      const totalGelos = (gelos.data || []).reduce((s: number, g: any) => s + g.quantidade, 0);
      const validVendasAll = (vendas.data || []).filter((v: any) => v.status !== "cancelada");
      const faturamento = validVendasAll.reduce((s: number, v: any) => s + Number(v.total), 0);

      // Faturamento semanal (últimos 7 dias)
      const seteDiasAtras = new Date(); seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      const faturamentoSemanal = validVendasAll
        .filter((v: any) => new Date(v.created_at) >= seteDiasAtras)
        .reduce((s: number, v: any) => s + Number(v.total), 0);

      // Faturamento mensal (mês corrente)
      const now = new Date();
      const faturamentoMensal = validVendasAll
        .filter((v: any) => { const d = new Date(v.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((s: number, v: any) => s + Number(v.total), 0);

      // Faturamento anual (ano corrente)
      const anoAtual = now.getFullYear();
      const faturamentoAnual = validVendasAll
        .filter((v: any) => new Date(v.created_at).getFullYear() === anoAtual)
        .reduce((s: number, v: any) => s + Number(v.total), 0);

      // Top sabores vendidos
      let topQuery = (supabase as any).from("venda_itens").select("sabor_id, quantidade, sabores(nome)");
      if (factoryId) topQuery = topQuery.eq("factory_id", factoryId);
      const { data: topData } = await topQuery;
      const saborMap: Record<string, { nome: string; total: number }> = {};
      (topData || []).forEach((item: any) => {
        const id = item.sabor_id;
        if (!saborMap[id]) saborMap[id] = { nome: item.sabores?.nome || "?", total: 0 };
        saborMap[id].total += item.quantidade;
      });
      setTopSabores(Object.values(saborMap).sort((a, b) => b.total - a.total).slice(0, 5));

      // Store raw data for dynamic filtering
      const validVendas = (vendas.data || []).filter((v: any) => v.status !== "cancelada");
      const validProd = producoes.data || [];
      setAllVendas(validVendas);
      setAllProducoes(validProd);

      // Build initial chart data (7 days)
      setVendasPorDia(buildChartData(validVendas, 7, "created_at", "total", true));
      setProducaoPorDia(buildChartData(validProd, 7, "created_at", "quantidade_total", false));

      // Alertas de estoque baixo
      let mpQuery = (supabase as any).from("materias_primas").select("nome, estoque_atual, estoque_minimo");
      let embQuery = (supabase as any).from("embalagens").select("nome, estoque_atual, estoque_minimo");
      if (factoryId) {
        mpQuery = mpQuery.eq("factory_id", factoryId);
        embQuery = embQuery.eq("factory_id", factoryId);
      }
      const [mpRes, embRes] = await Promise.all([mpQuery, embQuery]);
      const alertas: any[] = [];
      (mpRes.data || []).forEach((m: any) => {
        if (m.estoque_atual <= m.estoque_minimo) alertas.push({ nome: m.nome, tipo: "Matéria-prima", atual: m.estoque_atual, minimo: m.estoque_minimo });
      });
      (embRes.data || []).forEach((e: any) => {
        if (e.estoque_atual <= e.estoque_minimo) alertas.push({ nome: e.nome, tipo: "Embalagem", atual: e.estoque_atual, minimo: e.estoque_minimo });
      });
      (gelos.data || []).filter((g: any) => g.quantidade <= 0).forEach((g: any) => {
        alertas.push({ nome: g.sabores?.nome || "?", tipo: "Gelo", atual: g.quantidade, minimo: 0 });
      });
      setAlertasEstoque(alertas);

      // Contas a receber (vendas pendentes)
      const pendentes = (vendas.data || []).filter((v: any) => v.status === "pendente");
      const hoje = new Date().toISOString().split("T")[0];
      setContasReceber({
        total: pendentes.reduce((s: number, v: any) => s + Number(v.total), 0),
        vencidas: pendentes.filter((v: any) => v.created_at.split("T")[0] < hoje).length,
        quantidade: pendentes.length,
      });

      setStats({
        totalGelos, totalClientes: clientes.data?.length || 0,
        totalVendas: vendas.data?.length || 0, totalProducoes: producoes.data?.length || 0,
        faturamento, faturamentoSemanal, faturamentoMensal, faturamentoAnual,
        clientesInativos: inativos.data?.length || 0,
      });
    } catch (e) {
      console.error("Dashboard error:", e);
    }
  }

  const faturamentoValor = useMemo(() => {
    return allVendas
      .filter((v: any) => isWithinResumoPeriod(v.created_at, fatPeriodo))
      .reduce((s: number, v: any) => s + Number(v.total), 0);
  }, [allVendas, fatPeriodo]);

  const vendasCardValor = useMemo(() => {
    return allVendas.filter((v: any) => isWithinResumoPeriod(v.created_at, vendasPeriodo)).length;
  }, [allVendas, vendasPeriodo]);

  const producoesCardValor = useMemo(() => {
    return allProducoes.filter((p: any) => isWithinResumoPeriod(p.created_at, producoesPeriodo)).length;
  }, [allProducoes, producoesPeriodo]);

  const contasReceberResumo = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];
    const pendentesFiltradas = allVendas.filter(
      (v: any) => v.status === "pendente" && isWithinResumoPeriod(v.created_at, receberPeriodo),
    );

    return {
      total: pendentesFiltradas.reduce((s: number, v: any) => s + Number(v.total), 0),
      quantidade: pendentesFiltradas.length,
      vencidas: pendentesFiltradas.filter((v: any) => v.created_at.split("T")[0] < hoje).length,
    };
  }, [allVendas, receberPeriodo]);

  const cards = [
    { title: "Gelos em Estoque", value: stats.totalGelos.toLocaleString(), icon: Package, color: "text-primary", href: "/painel/estoque" },
    { title: "Clientes Ativos", value: stats.totalClientes, icon: Users, color: "text-secondary-foreground", href: "/painel/clientes" },
    { title: getResumoTitle("Vendas", vendasPeriodo), value: vendasCardValor, icon: ShoppingCart, color: "text-accent", href: "/painel/vendas", periodo: vendasPeriodo, onPeriodoChange: setVendasPeriodo },
    { title: getResumoTitle("Faturamento", fatPeriodo), value: `R$ ${faturamentoValor.toFixed(2)}`, icon: TrendingUp, color: "text-primary", href: "/painel/vendas", periodo: fatPeriodo, onPeriodoChange: setFatPeriodo },
    { title: getResumoTitle("Produções", producoesPeriodo), value: producoesCardValor, icon: Factory, color: "text-secondary-foreground", href: "/painel/producao", periodo: producoesPeriodo, onPeriodoChange: setProducoesPeriodo },
    { title: getResumoTitle("A Receber", receberPeriodo), value: `R$ ${contasReceberResumo.total.toFixed(2)}`, icon: DollarSign, color: contasReceberResumo.vencidas > 0 ? "text-destructive" : "text-primary", href: "/painel/a-receber", periodo: receberPeriodo, onPeriodoChange: setReceberPeriodo },
  ];

  return (
    <div className="relative">
      <GradientDots duration={30} colorCycleDuration={10} dotSize={5} spacing={14} className="opacity-15 pointer-events-none z-0 fixed" />
      {/* Animated Welcome Banner with Lamp Effect */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-background via-background to-primary/5">
        {/* Lamp glow effect - centered top (teal/cyan theme) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Main conic rays - left */}
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
          {/* Main conic rays - right */}
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
          {/* Soft glow blob */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.25, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 rounded-full blur-3xl"
            style={{ background: "hsl(174, 45%, 45%)" }}
          />
          {/* Thin light bar */}
          <motion.div
            initial={{ width: "4rem", opacity: 0 }}
            animate={{ width: "14rem", opacity: 0.6 }}
            transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px]"
            style={{ background: "linear-gradient(to right, transparent, hsl(174, 50%, 50%), transparent)" }}
          />
          {/* Bottom fade to blend */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Character watermark - only for Era dos Sabores */}
        {isIceAgeFactory && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 0.18, x: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="absolute -bottom-2 -right-2 w-20 h-20 pointer-events-none select-none z-10"
          >
            <img
              src={postItCharacters[Math.abs((user?.id || "").charCodeAt(0) || 0) % postItCharacters.length]}
              alt=""
              aria-hidden
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </motion.div>
        )}

        {/* Content */}
        <div className="relative z-20 px-6 py-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
            className="space-y-1.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{dailyMessage.emoji}</span>
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {getGreeting()}, <span className="text-primary">{userName || "Colaborador"}</span>!
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed pl-[2.75rem]">
              {dailyMessage.text}
            </p>
            <div className="pl-[2.75rem]">
              <span className="text-[10px] text-muted-foreground/50 tracking-wide uppercase">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Alertas de Estoque - Post-it Cards com Carrossel */}
      {alertasEstoque.length > 0 && (() => {
        // Group by tipo
        const grouped: Record<string, any[]> = {};
        alertasEstoque.forEach((a) => {
          if (!grouped[a.tipo]) grouped[a.tipo] = [];
          grouped[a.tipo].push(a);
        });
        const categories = Object.keys(grouped);

        const postItColors: Record<string, string> = {
          "Matéria-prima": "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700",
          "Embalagem": "bg-pink-100 dark:bg-pink-900/40 border-pink-200 dark:border-pink-700",
          "Gelo": "bg-sky-100 dark:bg-sky-900/40 border-sky-200 dark:border-sky-700",
        };
        const postItLabelColors: Record<string, string> = {
          "Matéria-prima": "text-red-600 dark:text-red-400",
          "Embalagem": "text-pink-600 dark:text-pink-400",
          "Gelo": "text-sky-600 dark:text-sky-400",
        };

        // Current category based on alertaIndex rotation
        const currentCatIdx = alertaIndex % categories.length;
        const currentCat = categories[currentCatIdx];
        const currentItems = grouped[currentCat] || [];
        const currentItem = currentItems[Math.floor(alertaIndex / categories.length) % currentItems.length] || currentItems[0];

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Rotating category cards */}
            {categories.slice(0, 3).map((cat, catIdx) => {
              const items = grouped[cat];
              const itemIdx = Math.floor(alertaIndex / categories.length) % items.length;
              const item = items[itemIdx] || items[0];
              const charImg = postItCharacters[catIdx % postItCharacters.length];

              return (
                <motion.div
                  key={cat + itemIdx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: catIdx * 0.08 }}
                  onClick={() => navigate("/painel/estoque")}
                  className="relative self-start overflow-hidden rounded-2xl p-[2px] cursor-pointer transition-transform hover:scale-[1.02]"
                >
                  <GlowingEffect
                    spread={58}
                    glow
                    disabled={false}
                    proximity={88}
                    inactiveZone={0.01}
                    borderWidth={5}
                    className="saturate-150"
                  />

                  <div className={`relative min-h-[140px] rounded-[inherit] border-2 ${postItColors[cat] || "bg-muted border-border"} p-4`}>
                    {/* Wave decoration top */}
                    <svg className="absolute top-0 left-0 right-0 w-full" viewBox="0 0 300 20" preserveAspectRatio="none" style={{ height: "14px" }}>
                      <path d="M0,10 Q30,0 60,10 T120,10 T180,10 T240,10 T300,10 L300,0 L0,0 Z" fill="currentColor" className="text-background/30" />
                    </svg>

                    {/* Category label + count */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`h-3.5 w-3.5 ${postItLabelColors[cat] || "text-foreground"}`} />
                        <span className={`text-xs font-extrabold uppercase tracking-wide ${postItLabelColors[cat] || "text-foreground"}`}>
                          {cat}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
                    </div>

                    {/* Item info */}
                    <p className="text-base font-bold text-foreground truncate mb-1">{item.nome}</p>
                    <p className="text-sm text-foreground/80">
                      Atual: <span className="font-bold text-primary">{item.atual}</span> / Mín: {item.minimo}
                    </p>

                    {/* Dots indicator */}
                    <div className="flex gap-1 mt-3">
                      {items.map((_: any, i: number) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full transition-colors ${i === itemIdx ? "bg-destructive" : "bg-foreground/20"}`}
                        />
                      ))}
                    </div>

                    {/* Character - only for Era dos Sabores */}
                    {isIceAgeFactory && (
                      <img
                        src={charImg}
                        alt=""
                        aria-hidden
                        className="absolute bottom-1 right-1 w-16 h-16 object-contain opacity-25 pointer-events-none select-none"
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Summary card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.24 }}
              onClick={() => navigate("/painel/estoque")}
              className="relative self-start overflow-hidden rounded-2xl p-[2px] cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <GlowingEffect
                spread={58}
                glow
                disabled={false}
                proximity={88}
                inactiveZone={0.01}
                borderWidth={5}
                className="saturate-150"
              />

              <div className="relative min-h-[140px] rounded-[inherit] border-2 border-green-200 dark:border-green-700 bg-green-100 dark:bg-green-900/40 p-4">
                {/* Wave decoration top */}
                <svg className="absolute top-0 left-0 right-0 w-full" viewBox="0 0 300 20" preserveAspectRatio="none" style={{ height: "14px" }}>
                  <path d="M0,10 Q30,0 60,10 T120,10 T180,10 T240,10 T300,10 L300,0 L0,0 Z" fill="currentColor" className="text-background/30" />
                </svg>

                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-foreground" />
                    <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">Resumo</span>
                  </div>
                  {/* Character top-right */}
                  <img
                    src={postItCharacters[3 % postItCharacters.length]}
                    alt=""
                    aria-hidden
                    className="w-10 h-10 object-contain opacity-30 pointer-events-none select-none"
                  />
                </div>

                <p className="text-3xl font-black text-foreground">{alertasEstoque.length}</p>
                <p className="text-xs text-muted-foreground mb-2">alertas ativos</p>

                {categories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/80">{cat}</span>
                    <span className="font-bold text-foreground">{grouped[cat].length}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((c: any, idx: number) => (
          <div key={c.title} className="relative self-start overflow-hidden rounded-xl border border-transparent p-0.5 opacity-0 animate-fade-in" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "forwards" }}>
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={4}
            />
            <Card
              className="relative cursor-pointer rounded-[calc(var(--radius)-2px)] border-0 bg-[hsl(var(--kpi-surface))] text-[hsl(var(--kpi-surface-foreground))] transition-all hover:scale-[1.03] hover:shadow-md"
              onClick={() => !c.isFaturamento && navigate(c.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-[hsl(var(--kpi-surface-muted-foreground))]">{c.title}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent className={c.periodo ? "flex min-h-[92px] flex-col justify-between gap-3" : undefined}>
                <p className="text-lg font-bold">{c.value}</p>
                {c.periodo && c.onPeriodoChange && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {RESUMO_PERIODOS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={(e) => { e.stopPropagation(); c.onPeriodoChange(value); }}
                          className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                            c.periodo === value
                              ? "bg-primary text-primary-foreground"
                              : "bg-[hsl(var(--kpi-surface-muted))] text-[hsl(var(--kpi-surface-muted-foreground))] hover:brightness-110"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 opacity-0 animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
        {/* Faturamento */}
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={3} />
          <Card className="relative border-0 bg-background">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Faturamento - {getPeriodLabel(periodoFaturamento, mesFaturamento)}</CardTitle>
                  <div className="flex gap-1">
                    {(["7dias", "15dias", "mensal"] as PeriodoFiltro[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriodoFaturamento(p)}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                          periodoFaturamento === p
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {p === "7dias" ? "7D" : p === "15dias" ? "15D" : MESES_NOME[mesFaturamento].slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                {periodoFaturamento === "mensal" && (
                  <div className="flex gap-1 flex-wrap">
                    {MESES_NOME.map((nome, idx) => (
                      <button
                        key={idx}
                        onClick={() => setMesFaturamento(idx)}
                        className={`px-1.5 py-0.5 text-[9px] rounded-full transition-colors ${
                          mesFaturamento === idx
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {nome.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={vendasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Produção */}
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={3} />
          <Card className="relative border-0 bg-background">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Produção - {getPeriodLabel(periodoProducao, mesProducao)}</CardTitle>
                  <div className="flex gap-1">
                    {(["7dias", "15dias", "mensal"] as PeriodoFiltro[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriodoProducao(p)}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                          periodoProducao === p
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {p === "7dias" ? "7D" : p === "15dias" ? "15D" : MESES_NOME[mesProducao].slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                {periodoProducao === "mensal" && (
                  <div className="flex gap-1 flex-wrap">
                    {MESES_NOME.map((nome, idx) => (
                      <button
                        key={idx}
                        onClick={() => setMesProducao(idx)}
                        className={`px-1.5 py-0.5 text-[9px] rounded-full transition-colors ${
                          mesProducao === idx
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {nome.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={producaoPorDia} style={{ cursor: "pointer" }} onClick={(e: any) => {
                  if (e?.activeLabel) {
                    // activeLabel is "DD/MM", resolve full date
                    const [d, m] = e.activeLabel.split("/").map(Number);
                    const year = periodoProducao === "mensal" ? new Date().getFullYear() : new Date().getFullYear();
                    const dateStr = `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${year}`;
                    navigate(`/painel/producao?data=${dateStr}`);
                  }
                }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => [`${v} un.`, "Produção"]} />
                  <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Widgets: Estoque Inteligente + Ranking + Clientes Inativos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 opacity-0 animate-fade-in" style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={15} glow disabled={false} proximity={32} inactiveZone={0.3} borderWidth={3} />
          <div className="relative"><EstoqueInteligente factoryId={factoryId} /></div>
        </div>
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={15} glow disabled={false} proximity={32} inactiveZone={0.3} borderWidth={3} />
          <div className="relative"><RankingClientes factoryId={factoryId} /></div>
        </div>
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={15} glow disabled={false} proximity={32} inactiveZone={0.3} borderWidth={3} />
          <div className="relative"><ClientesInativos factoryId={factoryId} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in" style={{ animationDelay: "900ms", animationFillMode: "forwards" }}>
        {/* Top 5 Sabores - Pie Chart */}
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={3} />
          <Card className="relative border-0 bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 Sabores Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {topSabores.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma venda registrada ainda.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={topSabores} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={false}>
                        {topSabores.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [`${v} un.`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {topSabores.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i] }} />
                        <span className="font-medium truncate">{s.nome}</span>
                        <span className="text-muted-foreground ml-auto">{s.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contas a Receber */}
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={3} />
          <Card className="relative border-0 bg-background">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className={`h-4 w-4 ${contasReceberResumo.vencidas > 0 ? "text-destructive" : "text-primary"}`} />
                  {getResumoTitle("Contas a Receber", receberPeriodo)}
                </CardTitle>
                <div className="flex flex-wrap gap-1 justify-end">
                  {RESUMO_PERIODOS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setReceberPeriodo(value)}
                      className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                        receberPeriodo === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Total pendente</span>
                  <span className="text-xl font-bold">R$ {contasReceberResumo.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Vendas pendentes</span>
                  <Badge variant="secondary">{contasReceberResumo.quantidade}</Badge>
                </div>
                {contasReceberResumo.vencidas > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-destructive text-sm font-medium">Vencidas</span>
                    <Badge variant="destructive">{contasReceberResumo.vencidas}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gastos com Colaboradores */}
      <div className="mt-6 opacity-0 animate-fade-in" style={{ animationDelay: "1100ms", animationFillMode: "forwards" }}>
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={3} />
          <div className="relative"><GastosColaboradores factoryId={factoryId} /></div>
        </div>
      </div>
    </div>
  );
}
