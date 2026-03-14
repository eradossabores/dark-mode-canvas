import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, Factory, Users, AlertTriangle, TrendingUp, DollarSign, Bell, Sparkles } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { motion } from "framer-motion";
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

const postItCharacters = [sidImg, scratAcornImg, buckImg, scrat3dImg, scratStandingImg, scratHangingImg];

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

type FaturamentoPeriodo = "total" | "semanal" | "mensal" | "anual";

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
  const { user } = useAuth();
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
  const [contasReceber, setContasReceber] = useState({ total: 0, vencidas: 0, quantidade: 0 });
  const [periodoFaturamento, setPeriodoFaturamento] = useState<PeriodoFiltro>("7dias");
  const [periodoProducao, setPeriodoProducao] = useState<PeriodoFiltro>("7dias");
  const [mesFaturamento, setMesFaturamento] = useState(new Date().getMonth());
  const [mesProducao, setMesProducao] = useState(new Date().getMonth());
  const [allVendas, setAllVendas] = useState<any[]>([]);
  const [allProducoes, setAllProducoes] = useState<any[]>([]);
  const [fatPeriodo, setFatPeriodo] = useState<FaturamentoPeriodo>("total");
  const [mesFatCard, setMesFatCard] = useState(new Date().getMonth());
  useEffect(() => { loadStats(); loadUserName(); }, []);

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
  }, [periodoProducao, allProducoes]);

  async function loadStats() {
    try {
      const [gelos, clientes, vendas, producoes, inativos] = await Promise.all([
        (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome)"),
        (supabase as any).from("clientes").select("id").eq("status", "ativo"),
        (supabase as any).from("vendas").select("total, created_at, status"),
        (supabase as any).from("producoes").select("quantidade_total, created_at"),
        (supabase as any).from("clientes").select("id").eq("status", "inativo"),
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
      const { data: topData } = await (supabase as any)
        .from("venda_itens").select("sabor_id, quantidade, sabores(nome)");
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
      const [mpRes, embRes] = await Promise.all([
        (supabase as any).from("materias_primas").select("nome, estoque_atual, estoque_minimo"),
        (supabase as any).from("embalagens").select("nome, estoque_atual, estoque_minimo"),
      ]);
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

  const faturamentoMesEspecifico = useMemo(() => {
    const ano = new Date().getFullYear();
    return allVendas
      .filter((v: any) => { const d = new Date(v.created_at); return d.getMonth() === mesFatCard && d.getFullYear() === ano; })
      .reduce((s: number, v: any) => s + Number(v.total), 0);
  }, [allVendas, mesFatCard]);

  const faturamentoValor = fatPeriodo === "semanal" ? stats.faturamentoSemanal : fatPeriodo === "mensal" ? faturamentoMesEspecifico : fatPeriodo === "anual" ? stats.faturamentoAnual : stats.faturamento;
  const faturamentoLabel = fatPeriodo === "semanal" ? "Fat. Semanal" : fatPeriodo === "mensal" ? `Fat. ${MESES_NOME[mesFatCard]}` : fatPeriodo === "anual" ? "Fat. Anual" : "Faturamento Total";

  const cards = [
    { title: "Gelos em Estoque", value: stats.totalGelos.toLocaleString(), icon: Package, color: "text-primary", href: "/painel/estoque" },
    { title: "Clientes Ativos", value: stats.totalClientes, icon: Users, color: "text-secondary-foreground", href: "/painel/clientes" },
    { title: "Total Vendas", value: stats.totalVendas, icon: ShoppingCart, color: "text-accent", href: "/painel/vendas" },
    { title: faturamentoLabel, value: `R$ ${faturamentoValor.toFixed(2)}`, icon: TrendingUp, color: "text-primary", href: "/painel/vendas", isFaturamento: true },
    { title: "Produções", value: stats.totalProducoes, icon: Factory, color: "text-secondary-foreground", href: "/painel/producao" },
    { title: "A Receber", value: `R$ ${contasReceber.total.toFixed(2)}`, icon: DollarSign, color: contasReceber.vencidas > 0 ? "text-destructive" : "text-primary", href: "/painel/a-receber" },
  ];

  return (
    <div>
      {/* Animated Welcome Banner with Lamp Effect */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-b from-background via-background to-primary/5">
        {/* Lamp glow effect - centered top */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Main conic rays - left */}
          <motion.div
            initial={{ opacity: 0, width: "6rem" }}
            animate={{ opacity: 0.5, width: "22rem" }}
            transition={{ delay: 0.1, duration: 1.2, ease: "easeOut" }}
            style={{ backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))` }}
            className="absolute -top-4 right-1/2 h-28 bg-gradient-conic from-primary/80 via-transparent to-transparent [--conic-position:from_70deg_at_center_top]"
          >
            <div className="absolute w-full left-0 bg-background/80 h-16 bottom-0 [mask-image:linear-gradient(to_top,white,transparent)]" />
            <div className="absolute w-16 h-full left-0 bg-background/80 bottom-0 [mask-image:linear-gradient(to_right,white,transparent)]" />
          </motion.div>
          {/* Main conic rays - right */}
          <motion.div
            initial={{ opacity: 0, width: "6rem" }}
            animate={{ opacity: 0.5, width: "22rem" }}
            transition={{ delay: 0.1, duration: 1.2, ease: "easeOut" }}
            style={{ backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))` }}
            className="absolute -top-4 left-1/2 h-28 bg-gradient-conic from-transparent via-transparent to-primary/80 [--conic-position:from_290deg_at_center_top]"
          >
            <div className="absolute w-16 h-full right-0 bg-background/80 bottom-0 [mask-image:linear-gradient(to_left,white,transparent)]" />
            <div className="absolute w-full right-0 bg-background/80 h-16 bottom-0 [mask-image:linear-gradient(to_top,white,transparent)]" />
          </motion.div>
          {/* Soft glow blob */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.25, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 rounded-full bg-primary blur-3xl"
          />
          {/* Thin light bar */}
          <motion.div
            initial={{ width: "4rem", opacity: 0 }}
            animate={{ width: "14rem", opacity: 0.7 }}
            transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
          />
          {/* Bottom fade to blend */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Character watermark */}
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

      {/* 4 Post-its por categoria */}
      {alertasEstoque.length > 0 && (() => {
        const categorias = [
          { tipo: "Matéria-prima", cor: "linear-gradient(135deg, hsl(45, 100%, 80%), hsl(45, 100%, 72%))", fita: "hsl(45, 30%, 85%)", rotate: "-rotate-1" },
          { tipo: "Embalagem", cor: "linear-gradient(135deg, hsl(340, 80%, 85%), hsl(340, 80%, 78%))", fita: "hsl(340, 30%, 88%)", rotate: "rotate-1" },
          { tipo: "Gelo", cor: "linear-gradient(135deg, hsl(200, 80%, 82%), hsl(200, 80%, 74%))", fita: "hsl(200, 30%, 85%)", rotate: "-rotate-2" },
        ];
        const grouped = categorias.map(cat => ({
          ...cat,
          items: alertasEstoque.filter(a => a.tipo === cat.tipo),
        })).filter(cat => cat.items.length > 0);

        // 4th post-it = resumo geral
        const totalCard = {
          cor: "linear-gradient(135deg, hsl(120, 55%, 82%), hsl(120, 55%, 74%))",
          fita: "hsl(120, 20%, 85%)",
          rotate: "rotate-1",
        };

        return (
          <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {grouped.map((cat) => {
              const visibleIndex = alertaIndex % cat.items.length;
              return (
                <div
                  key={cat.tipo}
                  className={`relative min-h-[140px] rounded-sm p-4 shadow-lg transform ${cat.rotate} overflow-hidden`}
                  style={{ background: cat.cor, boxShadow: "2px 4px 12px hsl(0 0% 0% / 0.15)" }}
                >
                  {/* Snow on post-it */}
                  <svg className="absolute top-0 left-0 w-full h-5 opacity-60" viewBox="0 0 200 20" preserveAspectRatio="none" fill="white">
                    <path d="M0,8 Q10,2 20,7 Q30,12 40,6 Q50,0 60,5 Q70,10 80,4 Q90,0 100,6 Q110,12 120,5 Q130,0 140,7 Q150,12 160,4 Q170,0 180,8 Q190,14 200,6 L200,0 L0,0 Z" />
                  </svg>
                  <svg className="absolute -top-1 left-0 w-full h-4 opacity-40" viewBox="0 0 200 16" preserveAspectRatio="none" fill="white">
                    <path d="M0,10 Q15,4 30,9 Q45,14 60,7 Q75,2 90,8 Q105,14 120,6 Q135,0 150,8 Q165,14 180,5 Q195,0 200,8 L200,0 L0,0 Z" />
                  </svg>
                  {/* Character on post-it */}
                  <img
                    src={postItCharacters[grouped.indexOf(cat) % postItCharacters.length]}
                    alt=""
                    aria-hidden
                    className="absolute bottom-2 right-1 w-12 h-12 object-contain opacity-[0.35] pointer-events-none select-none"
                  />
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 rounded-sm opacity-60" style={{ background: cat.fita }} />
                  <div className="mt-2 relative">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-[10px] font-bold text-destructive uppercase tracking-wide">{cat.tipo}</span>
                      <span className="text-[10px] text-foreground/60 ml-auto">{cat.items.length}</span>
                    </div>
                    <div key={visibleIndex} className="animate-fade-in">
                      <p className="text-sm font-extrabold text-foreground truncate">{cat.items[visibleIndex]?.nome}</p>
                      <p className="text-xs text-foreground/70 mt-1">
                        Atual: <span className="font-bold text-destructive">{cat.items[visibleIndex]?.atual}</span> / Mín: {cat.items[visibleIndex]?.minimo}
                      </p>
                    </div>
                    {cat.items.length > 1 && (
                      <div className="flex gap-1 mt-3">
                        {cat.items.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === visibleIndex ? "bg-destructive scale-125" : "bg-foreground/25"}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* 4º Post-it: Resumo */}
            <div
              className={`relative min-h-[140px] rounded-sm p-4 shadow-lg transform ${totalCard.rotate} overflow-hidden`}
              style={{ background: totalCard.cor, boxShadow: "2px 4px 12px hsl(0 0% 0% / 0.15)" }}
            >
              {/* Snow on post-it */}
              <svg className="absolute top-0 left-0 w-full h-5 opacity-60" viewBox="0 0 200 20" preserveAspectRatio="none" fill="white">
                <path d="M0,8 Q10,2 20,7 Q30,12 40,6 Q50,0 60,5 Q70,10 80,4 Q90,0 100,6 Q110,12 120,5 Q130,0 140,7 Q150,12 160,4 Q170,0 180,8 Q190,14 200,6 L200,0 L0,0 Z" />
              </svg>
              <svg className="absolute -top-1 left-0 w-full h-4 opacity-40" viewBox="0 0 200 16" preserveAspectRatio="none" fill="white">
                <path d="M0,10 Q15,4 30,9 Q45,14 60,7 Q75,2 90,8 Q105,14 120,6 Q135,0 150,8 Q165,14 180,5 Q195,0 200,8 L200,0 L0,0 Z" />
              </svg>
              {/* Character on summary post-it */}
              <img
                src={postItCharacters[3]}
                alt=""
                aria-hidden
                className="absolute top-2 right-1 w-12 h-12 object-contain opacity-[0.35] pointer-events-none select-none"
              />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 rounded-sm opacity-60" style={{ background: totalCard.fita }} />
              <div className="mt-2 relative">
                <div className="flex items-center gap-1.5 mb-2">
                  <Bell className="h-3.5 w-3.5 text-foreground/80" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/80">Resumo</span>
                </div>
                <p className="text-2xl font-extrabold text-foreground">{alertasEstoque.length}</p>
                <p className="text-xs text-foreground/70 mt-0.5">alertas ativos</p>
                <div className="mt-2 space-y-1">
                  {grouped.map(cat => (
                    <div key={cat.tipo} className="flex justify-between text-[11px] text-foreground/80">
                      <span>{cat.tipo}</span>
                      <span className="font-bold">{cat.items.length}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((c: any, idx: number) => (
          <div key={c.title} className="relative rounded-xl border-[0.75px] border-border p-0.5 opacity-0 animate-fade-in" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "forwards" }}>
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
            />
            <Card
              className="relative cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md border-0 bg-background"
              onClick={() => !c.isFaturamento && navigate(c.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{c.title}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{c.value}</p>
                {c.isFaturamento && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex gap-1">
                      {(["total", "semanal", "mensal", "anual"] as FaturamentoPeriodo[]).map((p) => (
                        <button
                          key={p}
                          onClick={(e) => { e.stopPropagation(); setFatPeriodo(p); }}
                          className={`px-1.5 py-0.5 text-[9px] rounded-full transition-colors ${
                            fatPeriodo === p
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {p === "total" ? "Total" : p === "semanal" ? "Semana" : p === "mensal" ? "Mês" : "Ano"}
                        </button>
                      ))}
                    </div>
                    {fatPeriodo === "mensal" && (
                      <div className="flex gap-0.5 flex-wrap">
                        {MESES_NOME.map((nome, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setMesFatCard(idx); }}
                            className={`px-1 py-0.5 text-[8px] rounded-full transition-colors ${
                              mesFatCard === idx
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
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={1} />
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
                        {p === "7dias" ? "7D" : p === "15dias" ? "15D" : "Mês"}
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
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={1} />
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
                        {p === "7dias" ? "7D" : p === "15dias" ? "15D" : "Mês"}
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
                <BarChart data={producaoPorDia}>
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
          <GlowingEffect spread={15} glow disabled={false} proximity={32} inactiveZone={0.3} borderWidth={1} />
          <div className="relative"><EstoqueInteligente /></div>
        </div>
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={15} glow disabled={false} proximity={32} inactiveZone={0.3} borderWidth={1} />
          <div className="relative"><RankingClientes /></div>
        </div>
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={15} glow disabled={false} proximity={32} inactiveZone={0.3} borderWidth={1} />
          <div className="relative"><ClientesInativos /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in" style={{ animationDelay: "900ms", animationFillMode: "forwards" }}>
        {/* Top 5 Sabores - Pie Chart */}
        <div className="relative rounded-xl border-[0.75px] border-border p-0.5">
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={1} />
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
          <GlowingEffect spread={20} glow disabled={false} proximity={40} inactiveZone={0.2} borderWidth={1} />
          <Card className="relative border-0 bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Contas a Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Total pendente</span>
                  <span className="text-xl font-bold">R$ {contasReceber.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Vendas pendentes</span>
                  <Badge variant="secondary">{contasReceber.quantidade}</Badge>
                </div>
                {contasReceber.vencidas > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-destructive text-sm font-medium">Vencidas</span>
                    <Badge variant="destructive">{contasReceber.vencidas}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
