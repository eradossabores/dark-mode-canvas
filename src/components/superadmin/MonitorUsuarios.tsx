import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Clock, Users, Wifi, BarChart3, Calendar, Factory, FileDown, AlertTriangle, TrendingUp, TrendingDown, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, subDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SessionRow {
  id: string;
  user_id: string;
  factory_id: string | null;
  started_at: string;
  last_seen_at: string;
  duration_minutes: number;
  user_name?: string;
  user_email?: string;
  factory_name?: string;
}

interface UserUsageSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  factory_name: string;
  factory_id: string;
  total_minutes: number;
  total_sessions: number;
  last_seen: string;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const INACTIVITY_DAYS_WARN = 7;
const INACTIVITY_DAYS_CRITICAL = 14;

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}h`);
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function MonitorUsuarios() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRow[]>([]);
  const [todaySessions, setTodaySessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");

  async function enrichSessions(data: any[]) {
    const userIds = [...new Set(data.map((s: any) => s.user_id))];
    const factoryIds = [...new Set(data.filter((s: any) => s.factory_id).map((s: any) => s.factory_id))];

    const [profilesRes, factoriesRes] = await Promise.all([
      userIds.length > 0 ? (supabase as any).from("profiles").select("id, nome, email").in("id", userIds) : { data: [] },
      factoryIds.length > 0 ? (supabase as any).from("factories").select("id, name").in("id", factoryIds) : { data: [] },
    ]);

    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
    const factoryMap = Object.fromEntries((factoriesRes.data || []).map((f: any) => [f.id, f]));

    return data.map((s: any) => ({
      ...s,
      user_name: profileMap[s.user_id]?.nome || "—",
      user_email: profileMap[s.user_id]?.email || "—",
      factory_name: s.factory_id ? factoryMap[s.factory_id]?.name || "—" : "—",
    }));
  }

  async function loadSessions() {
    setLoading(true);
    try {
      const since = subDays(new Date(), parseInt(period)).toISOString();
      const { data, error } = await (supabase as any)
        .from("user_sessions")
        .select("*")
        .gte("started_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const enriched = await enrichSessions(data || []);
      setSessions(enriched);

      // Load 60 days for monthly comparison
      const since60 = subDays(new Date(), 60).toISOString();
      const { data: allData } = await (supabase as any)
        .from("user_sessions")
        .select("*")
        .gte("started_at", since60)
        .order("last_seen_at", { ascending: false })
        .limit(1000);
      if (allData) {
        const enrichedAll = await enrichSessions(allData);
        setAllSessions(enrichedAll);
      }
    } catch (e) {
      console.error("Erro ao carregar sessões:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 30_000);
    return () => clearInterval(interval);
  }, [period]);

  // Load today's sessions
  async function loadTodaySessions() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await (supabase as any)
        .from("user_sessions")
        .select("*")
        .gte("started_at", todayStart.toISOString())
        .order("last_seen_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const enriched = await enrichSessions(data || []);
      setTodaySessions(enriched);
    } catch (e) {
      console.error("Erro ao carregar sessões de hoje:", e);
    }
  }

  useEffect(() => {
    loadTodaySessions();
    const interval = setInterval(loadTodaySessions, 15_000);

    // Realtime subscription
    const channel = supabase
      .channel("today-sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_sessions" },
        () => {
          loadTodaySessions();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const now = Date.now();
  const onlineUsers = sessions.filter((s) => now - new Date(s.last_seen_at).getTime() < ONLINE_THRESHOLD_MS);

  const uniqueOnline = Object.values(
    onlineUsers.reduce<Record<string, SessionRow>>((acc, s) => {
      if (!acc[s.user_id] || new Date(s.last_seen_at) > new Date(acc[s.user_id].last_seen_at)) acc[s.user_id] = s;
      return acc;
    }, {})
  );

  // Usage summary per user
  const usageSummary: UserUsageSummary[] = Object.values(
    sessions.reduce<Record<string, UserUsageSummary>>((acc, s) => {
      const key = s.user_id;
      if (!acc[key]) {
        acc[key] = { user_id: s.user_id, user_name: s.user_name || "—", user_email: s.user_email || "—", factory_name: s.factory_name || "—", factory_id: s.factory_id || "", total_minutes: 0, total_sessions: 0, last_seen: s.last_seen_at };
      }
      acc[key].total_minutes += s.duration_minutes;
      acc[key].total_sessions += 1;
      if (new Date(s.last_seen_at) > new Date(acc[key].last_seen)) acc[key].last_seen = s.last_seen_at;
      return acc;
    }, {})
  ).sort((a, b) => b.total_minutes - a.total_minutes);

  // Daily breakdown
  const dailyMap: Record<string, { sessions: number; minutes: number }> = {};
  sessions.forEach((s) => {
    const day = format(new Date(s.started_at), "yyyy-MM-dd");
    if (!dailyMap[day]) dailyMap[day] = { sessions: 0, minutes: 0 };
    dailyMap[day].sessions += 1;
    dailyMap[day].minutes += s.duration_minutes;
  });
  const dailyData = Object.entries(dailyMap).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30);

  // Factory usage summary
  interface FactoryUsage {
    factory_id: string;
    factory_name: string;
    total_minutes: number;
    total_sessions: number;
    unique_users: Set<string>;
    last_seen: string;
  }
  const factoryUsage = Object.values(
    sessions.reduce<Record<string, FactoryUsage>>((acc, s) => {
      const key = s.factory_id || "unknown";
      if (!acc[key]) acc[key] = { factory_id: key, factory_name: s.factory_name || "—", total_minutes: 0, total_sessions: 0, unique_users: new Set(), last_seen: s.last_seen_at };
      acc[key].total_minutes += s.duration_minutes;
      acc[key].total_sessions += 1;
      acc[key].unique_users.add(s.user_id);
      if (new Date(s.last_seen_at) > new Date(acc[key].last_seen)) acc[key].last_seen = s.last_seen_at;
      return acc;
    }, {})
  ).map((f) => ({ ...f, unique_users_count: f.unique_users.size })).sort((a, b) => b.total_minutes - a.total_minutes);

  // === HEATMAP: hours x days ===
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    sessions.forEach((s) => {
      const d = new Date(s.started_at);
      grid[d.getDay()][d.getHours()] += 1;
    });
    return grid;
  }, [sessions]);

  const heatmapMax = useMemo(() => Math.max(1, ...heatmapData.flat()), [heatmapData]);

  function heatColor(val: number) {
    if (val === 0) return "bg-muted/30";
    const intensity = val / heatmapMax;
    if (intensity > 0.75) return "bg-emerald-500";
    if (intensity > 0.5) return "bg-emerald-400";
    if (intensity > 0.25) return "bg-emerald-300 dark:bg-emerald-600";
    return "bg-emerald-200 dark:bg-emerald-800";
  }

  // === INACTIVITY ALERTS ===
  const inactiveFactories = useMemo(() => {
    // Get all factories and their last activity
    const factoryLastSeen: Record<string, { name: string; last_seen: string }> = {};
    allSessions.forEach((s) => {
      if (!s.factory_id) return;
      const key = s.factory_id;
      if (!factoryLastSeen[key] || new Date(s.last_seen_at) > new Date(factoryLastSeen[key].last_seen)) {
        factoryLastSeen[key] = { name: s.factory_name || "—", last_seen: s.last_seen_at };
      }
    });
    return Object.entries(factoryLastSeen)
      .map(([id, info]) => ({
        factory_id: id,
        factory_name: info.name,
        last_seen: info.last_seen,
        days_inactive: differenceInDays(new Date(), new Date(info.last_seen)),
      }))
      .filter((f) => f.days_inactive >= INACTIVITY_DAYS_WARN)
      .sort((a, b) => b.days_inactive - a.days_inactive);
  }, [allSessions]);

  // === MONTHLY COMPARISON ===
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let thisMonth = { sessions: 0, minutes: 0, users: new Set<string>() };
    let lastMonth = { sessions: 0, minutes: 0, users: new Set<string>() };

    allSessions.forEach((s) => {
      const d = new Date(s.started_at);
      if (d >= thisMonthStart) {
        thisMonth.sessions += 1;
        thisMonth.minutes += s.duration_minutes;
        thisMonth.users.add(s.user_id);
      } else if (d >= lastMonthStart && d <= lastMonthEnd) {
        lastMonth.sessions += 1;
        lastMonth.minutes += s.duration_minutes;
        lastMonth.users.add(s.user_id);
      }
    });

    const pctChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    return {
      thisMonth: { sessions: thisMonth.sessions, minutes: thisMonth.minutes, users: thisMonth.users.size },
      lastMonth: { sessions: lastMonth.sessions, minutes: lastMonth.minutes, users: lastMonth.users.size },
      changes: {
        sessions: pctChange(thisMonth.sessions, lastMonth.sessions),
        minutes: pctChange(thisMonth.minutes, lastMonth.minutes),
        users: pctChange(thisMonth.users.size, lastMonth.users.size),
      },
    };
  }, [allSessions]);

  function formatMinutes(min: number) {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  const totalMinutes = usageSummary.reduce((a, b) => a + b.total_minutes, 0);

  function ChangeIndicator({ value }: { value: number }) {
    if (value > 0) return <span className="flex items-center gap-0.5 text-emerald-500 text-xs font-medium"><TrendingUp className="h-3 w-3" />+{value}%</span>;
    if (value < 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium"><TrendingDown className="h-3 w-3" />{value}%</span>;
    return <span className="text-xs text-muted-foreground">0%</span>;
  }

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy HH:mm");

    doc.setFontSize(16);
    doc.text("ICETECH — Relatório de Uso", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: últimos ${period} dias | Gerado em: ${date}`, 14, 26);

    doc.setFontSize(12);
    doc.text("Uso por Fábrica", 14, 36);
    autoTable(doc, {
      startY: 40,
      head: [["Fábrica", "Usuários", "Sessões", "Tempo Total", "Último Acesso"]],
      body: factoryUsage.map((f) => [f.factory_name, f.unique_users_count.toString(), f.total_sessions.toString(), formatMinutes(f.total_minutes), format(new Date(f.last_seen), "dd/MM/yyyy HH:mm")]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(12);
    doc.text("Ranking de Usuários", 14, finalY + 10);
    autoTable(doc, {
      startY: finalY + 14,
      head: [["#", "Usuário", "Email", "Fábrica", "Sessões", "Tempo Total"]],
      body: usageSummary.map((u, i) => [(i + 1).toString(), u.user_name, u.user_email, u.factory_name, u.total_sessions.toString(), formatMinutes(u.total_minutes)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    doc.save(`relatorio-uso-${period}dias.pdf`);
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><Wifi className="h-5 w-5 text-emerald-500" /></div>
            <div>
              <p className="text-2xl font-bold">{uniqueOnline.length}</p>
              <p className="text-xs text-muted-foreground">Online Agora</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center"><Users className="h-5 w-5 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold">{usageSummary.length}</p>
              <p className="text-xs text-muted-foreground">Usuários Ativos ({period}d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center"><Activity className="h-5 w-5 text-amber-500" /></div>
            <div>
              <p className="text-2xl font-bold">{sessions.length}</p>
              <p className="text-xs text-muted-foreground">Sessões ({period}d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center"><Clock className="h-5 w-5 text-purple-500" /></div>
            <div>
              <p className="text-2xl font-bold">{formatMinutes(totalMinutes)}</p>
              <p className="text-xs text-muted-foreground">Tempo Total ({period}d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Comparativo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Sessões</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold">{monthlyComparison.thisMonth.sessions}</span>
                <ChangeIndicator value={monthlyComparison.changes.sessions} />
              </div>
              <p className="text-[11px] text-muted-foreground">Mês anterior: {monthlyComparison.lastMonth.sessions}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Tempo de Uso</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold">{formatMinutes(monthlyComparison.thisMonth.minutes)}</span>
                <ChangeIndicator value={monthlyComparison.changes.minutes} />
              </div>
              <p className="text-[11px] text-muted-foreground">Mês anterior: {formatMinutes(monthlyComparison.lastMonth.minutes)}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Usuários Ativos</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold">{monthlyComparison.thisMonth.users}</span>
                <ChangeIndicator value={monthlyComparison.changes.users} />
              </div>
              <p className="text-[11px] text-muted-foreground">Mês anterior: {monthlyComparison.lastMonth.users}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inactivity Alerts */}
      {inactiveFactories.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas de Inatividade
              <Badge variant="destructive" className="ml-auto text-[10px]">{inactiveFactories.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveFactories.map((f) => (
                <div key={f.factory_id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${f.days_inactive >= INACTIVITY_DAYS_CRITICAL ? "bg-red-500/10 border border-red-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                  <div className="flex items-center gap-2">
                    <Factory className={`h-4 w-4 ${f.days_inactive >= INACTIVITY_DAYS_CRITICAL ? "text-red-500" : "text-amber-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{f.factory_name}</p>
                      <p className="text-[11px] text-muted-foreground">Último acesso: {format(new Date(f.last_seen), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                  </div>
                  <Badge variant={f.days_inactive >= INACTIVITY_DAYS_CRITICAL ? "destructive" : "outline"} className="text-xs">
                    {f.days_inactive} dias inativo
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Online Users */}
      {uniqueOnline.length > 0 && (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              Usuários Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {uniqueOnline.map((s) => (
                <div key={s.user_id} className="flex items-center gap-2 bg-emerald-500/10 rounded-lg px-3 py-2">
                  <Wifi className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">{s.user_name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.factory_name}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] ml-1">{formatMinutes(s.duration_minutes)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-amber-500" /> Horários de Pico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={0}>
              <div className="min-w-[600px]">
                <div className="flex mb-1">
                  <div className="w-10 shrink-0" />
                  {HOUR_LABELS.map((h) => (
                    <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h}</div>
                  ))}
                </div>
                {heatmapData.map((row, dayIdx) => (
                  <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-10 shrink-0 text-[10px] text-muted-foreground font-medium">{DAY_LABELS[dayIdx]}</div>
                    {row.map((val, hourIdx) => (
                      <Tooltip key={hourIdx}>
                        <TooltipTrigger asChild>
                          <div className={`flex-1 h-5 rounded-sm cursor-default transition-colors ${heatColor(val)}`} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {DAY_LABELS[dayIdx]} {HOUR_LABELS[hourIdx]}: <strong>{val}</strong> sessões
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <span className="text-[10px] text-muted-foreground">Menos</span>
                  <div className="h-3 w-3 rounded-sm bg-muted/30" />
                  <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-800" />
                  <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-600" />
                  <div className="h-3 w-3 rounded-sm bg-emerald-400" />
                  <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Mais</span>
                </div>
              </div>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="ranking">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="hoje" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Hoje</TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Ranking</TabsTrigger>
            <TabsTrigger value="fabricas" className="gap-1.5"><Factory className="h-3.5 w-3.5" /> Por Fábrica</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
            <TabsTrigger value="diario" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Por Dia</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPDF}>
              <FileDown className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="hoje">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Atividade em Tempo Real — Hoje
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {todaySessions.length} sessões · Atualiza a cada 15s
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {todaySessions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma sessão registrada hoje.</p>
              ) : (
                <>
                  {/* Today summary cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 pb-2">
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Sessões Hoje</p>
                      <p className="text-xl font-bold">{todaySessions.length}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Usuários Únicos</p>
                      <p className="text-xl font-bold">{new Set(todaySessions.map(s => s.user_id)).size}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Tempo Total</p>
                      <p className="text-xl font-bold">{formatMinutes(todaySessions.reduce((a, s) => a + s.duration_minutes, 0))}</p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Fábrica</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead className="text-right">Duração</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todaySessions.map((s) => {
                        const isOnlineNow = now - new Date(s.last_seen_at).getTime() < ONLINE_THRESHOLD_MS;
                        return (
                          <TableRow key={s.id} className={isOnlineNow ? "bg-emerald-500/5" : ""}>
                            <TableCell>
                              {isOnlineNow ? (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                </span>
                              ) : (
                                <span className="flex h-3 w-3 rounded-full bg-muted-foreground/30" />
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{s.user_name}</p>
                              <p className="text-[11px] text-muted-foreground">{s.user_email}</p>
                            </TableCell>
                            <TableCell className="text-sm">{s.factory_name}</TableCell>
                            <TableCell className="text-sm">{format(new Date(s.started_at), "HH:mm", { locale: ptBR })}</TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {isOnlineNow ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  {formatMinutes(s.duration_minutes)} · Ativo
                                </Badge>
                              ) : (
                                formatMinutes(s.duration_minutes)
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
              ) : usageSummary.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma sessão encontrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Fábrica</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Tempo Total</TableHead>
                      <TableHead className="text-right">Último Acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageSummary.map((u, i) => {
                      const isOnline = now - new Date(u.last_seen).getTime() < ONLINE_THRESHOLD_MS;
                      return (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isOnline && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                              )}
                              <div>
                                <p className="font-medium text-sm">{u.user_name}</p>
                                <p className="text-[11px] text-muted-foreground">{u.user_email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{u.factory_name}</TableCell>
                          <TableCell className="text-right text-sm">{u.total_sessions}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatMinutes(u.total_minutes)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {isOnline ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Agora</Badge>
                            ) : (
                              formatDistanceToNow(new Date(u.last_seen), { addSuffix: true, locale: ptBR })
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fabricas">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
              ) : factoryUsage.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum dado encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Fábrica</TableHead>
                      <TableHead className="text-right">Usuários</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Tempo Total</TableHead>
                      <TableHead className="text-right">Média/Usuário</TableHead>
                      <TableHead className="text-right">Último Acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factoryUsage.map((f, i) => (
                      <TableRow key={f.factory_id}>
                        <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{f.factory_name}</TableCell>
                        <TableCell className="text-right text-sm">{f.unique_users_count}</TableCell>
                        <TableCell className="text-right text-sm">{f.total_sessions}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatMinutes(f.total_minutes)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {f.unique_users_count > 0 ? formatMinutes(Math.round(f.total_minutes / f.unique_users_count)) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(f.last_seen), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Fábrica</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Último Sinal</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.slice(0, 50).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{s.user_name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.user_email}</p>
                        </TableCell>
                        <TableCell className="text-sm">{s.factory_name}</TableCell>
                        <TableCell className="text-sm">{format(new Date(s.started_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-sm">{format(new Date(s.last_seen_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatMinutes(s.duration_minutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diario">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Tempo Total</TableHead>
                    <TableHead className="text-right">Média/Sessão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData.map(([day, d]) => (
                    <TableRow key={day}>
                      <TableCell className="font-medium text-sm">{format(new Date(day + "T12:00:00"), "EEEE, dd/MM", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right text-sm">{d.sessions}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatMinutes(d.minutes)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {d.sessions > 0 ? formatMinutes(Math.round(d.minutes / d.sessions)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
