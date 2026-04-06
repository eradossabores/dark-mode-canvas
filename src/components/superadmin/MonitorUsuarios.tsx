import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Clock, Users, Wifi, WifiOff, BarChart3, Calendar, Factory, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  total_minutes: number;
  total_sessions: number;
  last_seen: string;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 min

export default function MonitorUsuarios() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");

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

      // Enrich with profiles and factory names
      const userIds = [...new Set((data || []).map((s: any) => s.user_id))];
      const factoryIds = [...new Set((data || []).filter((s: any) => s.factory_id).map((s: any) => s.factory_id))];

      const [profilesRes, factoriesRes] = await Promise.all([
        userIds.length > 0
          ? (supabase as any).from("profiles").select("id, nome, email").in("id", userIds)
          : { data: [] },
        factoryIds.length > 0
          ? (supabase as any).from("factories").select("id, name").in("id", factoryIds)
          : { data: [] },
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
      const factoryMap = Object.fromEntries((factoriesRes.data || []).map((f: any) => [f.id, f]));

      const enriched: SessionRow[] = (data || []).map((s: any) => ({
        ...s,
        user_name: profileMap[s.user_id]?.nome || "—",
        user_email: profileMap[s.user_id]?.email || "—",
        factory_name: s.factory_id ? factoryMap[s.factory_id]?.name || "—" : "—",
      }));

      setSessions(enriched);
    } catch (e) {
      console.error("Erro ao carregar sessões:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [period]);

  const now = Date.now();
  const onlineUsers = sessions.filter(
    (s) => now - new Date(s.last_seen_at).getTime() < ONLINE_THRESHOLD_MS
  );

  // Unique online users (latest session per user)
  const uniqueOnline = Object.values(
    onlineUsers.reduce<Record<string, SessionRow>>((acc, s) => {
      if (!acc[s.user_id] || new Date(s.last_seen_at) > new Date(acc[s.user_id].last_seen_at)) {
        acc[s.user_id] = s;
      }
      return acc;
    }, {})
  );

  // Usage summary per user
  const usageSummary: UserUsageSummary[] = Object.values(
    sessions.reduce<Record<string, UserUsageSummary>>((acc, s) => {
      const key = s.user_id;
      if (!acc[key]) {
        acc[key] = {
          user_id: s.user_id,
          user_name: s.user_name || "—",
          user_email: s.user_email || "—",
          factory_name: s.factory_name || "—",
          total_minutes: 0,
          total_sessions: 0,
          last_seen: s.last_seen_at,
        };
      }
      acc[key].total_minutes += s.duration_minutes;
      acc[key].total_sessions += 1;
      if (new Date(s.last_seen_at) > new Date(acc[key].last_seen)) {
        acc[key].last_seen = s.last_seen_at;
      }
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
  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30);

  // Factory usage summary
  interface FactoryUsage {
    factory_id: string;
    factory_name: string;
    total_minutes: number;
    total_sessions: number;
    unique_users: Set<string>;
    last_seen: string;
  }
  const factoryUsage: (Omit<FactoryUsage, "unique_users"> & { unique_users: number })[] = Object.values(
    sessions.reduce<Record<string, FactoryUsage>>((acc, s) => {
      const key = s.factory_id || "unknown";
      if (!acc[key]) {
        acc[key] = {
          factory_id: key,
          factory_name: s.factory_name || "—",
          total_minutes: 0,
          total_sessions: 0,
          unique_users: new Set(),
          last_seen: s.last_seen_at,
        };
      }
      acc[key].total_minutes += s.duration_minutes;
      acc[key].total_sessions += 1;
      acc[key].unique_users.add(s.user_id);
      if (new Date(s.last_seen_at) > new Date(acc[key].last_seen)) {
        acc[key].last_seen = s.last_seen_at;
      }
      return acc;
    }, {})
  ).map((f) => ({ ...f, unique_users: f.unique_users.size }))
   .sort((a, b) => b.total_minutes - a.total_minutes);

  function formatMinutes(min: number) {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  const totalMinutes = usageSummary.reduce((a, b) => a + b.total_minutes, 0);

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const title = `Relatório de Uso — Últimos ${period} dias`;
    const date = format(new Date(), "dd/MM/yyyy HH:mm");

    doc.setFontSize(16);
    doc.text("ICETECH — Relatório de Uso", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: últimos ${period} dias | Gerado em: ${date}`, 14, 26);

    // Factory table
    doc.setFontSize(12);
    doc.text("Uso por Fábrica", 14, 36);
    autoTable(doc, {
      startY: 40,
      head: [["Fábrica", "Usuários", "Sessões", "Tempo Total", "Último Acesso"]],
      body: factoryUsage.map((f) => [
        f.factory_name,
        f.unique_users.toString(),
        f.total_sessions.toString(),
        formatMinutes(f.total_minutes),
        format(new Date(f.last_seen), "dd/MM/yyyy HH:mm"),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    // User ranking table
    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(12);
    doc.text("Ranking de Usuários", 14, finalY + 10);
    autoTable(doc, {
      startY: finalY + 14,
      head: [["#", "Usuário", "Email", "Fábrica", "Sessões", "Tempo Total"]],
      body: usageSummary.map((u, i) => [
        (i + 1).toString(),
        u.user_name,
        u.user_email,
        u.factory_name,
        u.total_sessions.toString(),
        formatMinutes(u.total_minutes),
      ]),
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
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Wifi className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueOnline.length}</p>
              <p className="text-xs text-muted-foreground">Online Agora</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{usageSummary.length}</p>
              <p className="text-xs text-muted-foreground">Usuários Ativos ({period}d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Activity className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sessions.length}</p>
              <p className="text-xs text-muted-foreground">Sessões ({period}d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMinutes(totalMinutes)}</p>
              <p className="text-xs text-muted-foreground">Tempo Total ({period}d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {formatMinutes(s.duration_minutes)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for details */}
      <Tabs defaultValue="ranking">
        <div className="flex items-center justify-between mb-2">
          <TabsList>
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
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ranking */}
        <TabsContent value="ranking">
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

        {/* Histórico */}
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
                        <TableCell className="text-sm">
                          {format(new Date(s.started_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(s.last_seen_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatMinutes(s.duration_minutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Por Dia */}
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
                      <TableCell className="font-medium text-sm">
                        {format(new Date(day + "T12:00:00"), "EEEE, dd/MM", { locale: ptBR })}
                      </TableCell>
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
