import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Monitor, Clock, User, Package, CalendarClock, MessageSquare,
  Maximize2, Minimize2, CheckCircle2, PackageCheck, Hourglass,
  HandMetal, Pencil, Smartphone, Volume2, VolumeX, Printer,
  Timer, AlertTriangle, Snowflake, ArrowRight
} from "lucide-react";
import EditPedidoDialog from "@/components/monitor/EditPedidoDialog";
import MonitorTopBar from "@/components/monitor/MonitorTopBar";
import { useMonitorAlerts } from "@/hooks/useMonitorAlerts";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function getElapsedTime(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { locale: ptBR, addSuffix: false });
}

function handlePrintPedido(pedido: any) {
  const itens = (pedido.pedido_producao_itens || [])
    .map((i: any) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${i.sabores?.nome || "-"}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;font-size:16px">${i.quantidade}</td></tr>`)
    .join("");
  const totalUn = (pedido.pedido_producao_itens || []).reduce((s: number, i: any) => s + (i.quantidade || 0), 0);
  const html = `<html><head><title>Pedido - ${pedido.clientes?.nome}</title>
    <style>body{font-family:system-ui,sans-serif;padding:20px;max-width:380px;margin:0 auto}
    h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}
    .meta{color:#666;font-size:13px;margin:4px 0}.total{font-size:18px;font-weight:bold;margin-top:8px}
    @media print{body{padding:10px}}</style></head><body>
    <h2>📋 ${pedido.clientes?.nome}</h2>
    <p class="meta">Entrega: ${format(new Date(pedido.data_entrega), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
    <p class="meta">Embalagem: ${pedido.tipo_embalagem || "-"}</p>
    ${pedido.observacoes ? `<p class="meta" style="color:#b45309">⚠ ${pedido.observacoes}</p>` : ""}
    <table><thead><tr><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase">Sabor</th><th style="padding:8px 12px;text-align:right;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase">Qtd</th></tr></thead><tbody>${itens}</tbody></table>
    <p class="total">Total: ${totalUn} unidades</p>
    <script>window.onload=()=>{window.print()}</script></body></html>`;
  const win = window.open("", "_blank", "width=420,height=600");
  if (win) { win.document.write(html); win.document.close(); }
}

const statusLabels: Record<string, string> = {
  aguardando_producao: "Aguardando",
  em_producao: "Em Produção",
  separado_para_entrega: "Separado p/ Entrega",
  retirado: "Separado p/ Retirada",
  enviado: "Finalizado",
};

const statusIcons: Record<string, any> = {
  aguardando_producao: Hourglass,
  em_producao: Snowflake,
  separado_para_entrega: PackageCheck,
  retirado: HandMetal,
  enviado: CheckCircle2,
};

function getUrgencyLabel(dataEntrega: string) {
  const d = new Date(dataEntrega);
  if (isPast(d)) return { label: "ATRASADO", type: "atrasado" };
  if (isToday(d)) return { label: "HOJE", type: "hoje" };
  if (isTomorrow(d)) return { label: "AMANHÃ", type: "amanha" };
  return null;
}

const REFRESH_INTERVAL = 30;
const AUTO_SCROLL_INTERVAL = 8000;

export default function MonitorProducao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullscreenPedidoId, setFullscreenPedidoId] = useState<string | null>(null);
  const [editPedido, setEditPedido] = useState<any>(null);
  const [isFullPage, setIsFullPage] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [prevTheme, setPrevTheme] = useState<string | null>(null);

  // Auto dark mode for TV
  useEffect(() => {
    if (isFullPage) {
      const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
      setPrevTheme(current);
      document.documentElement.classList.add("dark");
    } else if (prevTheme !== null) {
      if (prevTheme === "light") {
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
      }
      setPrevTheme(null);
    }
  }, [isFullPage]);

  // Auto-scroll in fullscreen
  useEffect(() => {
    if (!isFullPage || fullscreenPedidoId) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    let direction = 1;
    const timer = setInterval(() => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;
      if (container.scrollTop >= maxScroll - 10) direction = -1;
      if (container.scrollTop <= 10) direction = 1;
      container.scrollBy({ top: direction * container.clientHeight * 0.6, behavior: "smooth" });
    }, AUTO_SCROLL_INTERVAL);
    const pause = () => clearInterval(timer);
    container.addEventListener("pointerdown", pause, { once: true });
    return () => { clearInterval(timer); container.removeEventListener("pointerdown", pause); };
  }, [isFullPage, fullscreenPedidoId]);

  // Auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
          queryClient.invalidateQueries({ queryKey: ["monitor-gelos"] });
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [queryClient]);

  const toggleFullPage = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (screen.orientation && (screen.orientation as any).lock) {
          try { await (screen.orientation as any).lock("landscape"); } catch (e) {}
        }
        setIsFullPage(true);
      } else {
        if (screen.orientation && (screen.orientation as any).unlock) {
          try { (screen.orientation as any).unlock(); } catch (e) {}
        }
        await document.exitFullscreen();
        setIsFullPage(false);
      }
    } catch (err) { console.error("Fullscreen error:", err); }
  }, []);

  useEffect(() => {
    const handleChange = () => {
      if (!document.fullscreenElement) {
        setIsFullPage(false);
        if (screen.orientation && (screen.orientation as any).unlock) {
          try { (screen.orientation as any).unlock(); } catch (e) {}
        }
      }
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const { data: gelos } = useQuery({
    queryKey: ["monitor-gelos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_gelos").select("*, sabores(nome)").order("quantidade", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["monitor-pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_producao")
        .select("*, clientes(nome), pedido_producao_itens(*, sabores(nome))")
        .in("status", ["aguardando_producao", "em_producao", "separado_para_entrega", "retirado"])
        .order("data_entrega", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useMonitorAlerts(pedidos, soundEnabled);
  const totalGelos = (gelos || []).reduce((s: number, g: any) => s + (g.quantidade || 0), 0);

  useEffect(() => {
    const channel = supabase.channel("monitor-pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_producao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pedidos_producao").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] }); toast({ title: "Status atualizado!" }); },
    onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
  });

  const toggleSeparado = useMutation({
    mutationFn: async ({ itemId, separado }: { itemId: string; separado: boolean }) => {
      const { error } = await (supabase as any).from("pedido_producao_itens").update({ separado }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] }); },
    onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
  });

  const activeOrders = pedidos?.filter((p: any) => p.status !== "enviado") || [];
  const filaEspera = pedidos?.filter((p: any) => p.status === "aguardando_producao") || [];
  const emAndamento = pedidos?.filter((p: any) => p.status === "em_producao" || p.status === "separado_para_entrega" || p.status === "retirado") || [];

  const tv = isFullPage;

  const renderCard = (pedido: any, index: number) => {
    const urgency = getUrgencyLabel(pedido.data_entrega);
    const isExpanded = fullscreenPedidoId === pedido.id;
    const totalItens = pedido.pedido_producao_itens?.length || 0;
    const separadosCount = pedido.pedido_producao_itens?.filter((i: any) => i.separado).length || 0;
    const progressPercent = totalItens > 0 ? Math.round((separadosCount / totalItens) * 100) : 0;
    const totalUn = pedido.pedido_producao_itens?.reduce((s: number, i: any) => s + (i.quantidade || 0), 0) || 0;
    const flashClass = urgency?.type === "atrasado" ? "monitor-card-atrasado" : urgency?.type === "hoje" ? "monitor-card-hoje" : "";

    if (isExpanded) {
      return (
        <div key={pedido.id} className="fixed inset-0 z-50 overflow-auto bg-background/95 backdrop-blur-md p-8">
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => setFullscreenPedidoId(null)} className="mb-4 gap-2">
              <Minimize2 className="h-4 w-4" /> Fechar
            </Button>
            {renderCardInner(pedido, urgency, totalItens, separadosCount, progressPercent, totalUn)}
          </div>
        </div>
      );
    }

    return (
      <div key={pedido.id} className={`animate-fade-in ${flashClass}`} style={{ animationDelay: `${index * 60}ms` }}>
        {renderCardInner(pedido, urgency, totalItens, separadosCount, progressPercent, totalUn)}
      </div>
    );
  };

  const StatusIcon = (status: string) => statusIcons[status] || Monitor;

  const renderCardInner = (pedido: any, urgency: any, totalItens: number, separadosCount: number, progressPercent: number, totalUn: number) => {
    const Icon = StatusIcon(pedido.status);

    return (
      <div className="rounded-2xl overflow-hidden bg-card border border-border shadow-[var(--shadow-md)] transition-all duration-300 hover:shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className={`${tv ? "text-xl" : "text-base"} font-bold text-foreground truncate`}>
                  {pedido.clientes?.nome}
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {format(new Date(pedido.data_entrega), "dd/MM · HH:mm", { locale: ptBR })}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {getElapsedTime(pedido.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {urgency && (
                <Badge
                  variant="destructive"
                  className={`text-[10px] font-bold px-2 py-0.5 ${urgency.type === "atrasado" ? "animate-pulse" : ""} ${
                    urgency.type === "amanha" ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  {urgency.label}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] font-semibold gap-1 px-2 py-0.5">
                <Icon className="h-3 w-3" />
                {statusLabels[pedido.status]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Meta + progress */}
        <div className="px-5 py-3 bg-muted/20 border-b border-border/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> {pedido.tipo_embalagem}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressPercent === 100 ? "bg-secondary-foreground" : "bg-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-muted-foreground tabular-nums">
                {separadosCount}/{totalItens}
              </span>
            </div>
            <Badge variant="outline" className="text-xs font-bold tabular-nums px-2 py-0.5 border-primary/30 text-primary">
              {totalUn} un
            </Badge>
          </div>
        </div>

        {/* Observações */}
        {pedido.observacoes && (
          <div className="mx-5 mt-3 flex items-start gap-2 text-xs p-3 bg-accent/10 rounded-xl border border-accent/20">
            <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
            <span className="text-accent-foreground">{pedido.observacoes}</span>
          </div>
        )}

        {/* Checklist */}
        <div className="px-5 py-3">
          <div className="space-y-1">
            {pedido.pedido_producao_itens?.map((item: any) => {
              const isSeparado = item.separado === true;
              return (
                <div
                  key={item.id}
                  className={`group flex items-center gap-3 rounded-xl px-3 ${tv ? "py-3" : "py-2.5"} cursor-pointer select-none transition-all duration-150 ${
                    isSeparado
                      ? "bg-secondary/40"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleSeparado.mutate({ itemId: item.id, separado: !isSeparado })}
                >
                  <Checkbox
                    checked={isSeparado}
                    onCheckedChange={(checked) => toggleSeparado.mutate({ itemId: item.id, separado: !!checked })}
                    className={`pointer-events-none ${tv ? "h-5 w-5" : "h-4 w-4"} rounded-md border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary`}
                  />
                  <span className={`flex-1 ${tv ? "text-sm" : "text-[13px]"} font-medium transition-all ${
                    isSeparado ? "line-through text-muted-foreground" : "text-foreground"
                  }`}>
                    {item.sabores?.nome}
                  </span>
                  <span className={`${tv ? "text-lg" : "text-base"} font-bold tabular-nums transition-all ${
                    isSeparado ? "text-muted-foreground" : "text-foreground"
                  }`}>
                    {item.quantidade}
                  </span>
                  {isSeparado && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center gap-2">
          {pedido.status !== "separado_para_entrega" && pedido.status !== "retirado" && pedido.status !== "enviado" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 font-semibold text-xs rounded-xl h-9"
              onClick={() => updateStatus.mutate({ id: pedido.id, status: "separado_para_entrega" })}
            >
              <PackageCheck className="h-3.5 w-3.5" /> Entrega
            </Button>
          )}
          {pedido.status !== "retirado" && pedido.status !== "enviado" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 font-semibold text-xs rounded-xl h-9"
              onClick={() => updateStatus.mutate({ id: pedido.id, status: "retirado" })}
            >
              <HandMetal className="h-3.5 w-3.5" /> Retirada
            </Button>
          )}
          {pedido.status !== "enviado" && (
            <Button
              size="sm"
              className="flex-1 gap-1.5 font-semibold text-xs rounded-xl h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => updateStatus.mutate({ id: pedido.id, status: "enviado" })}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
            </Button>
          )}
          <div className="flex items-center gap-0.5 ml-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditPedido(pedido)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handlePrintPedido(pedido)}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setFullscreenPedidoId(pedido.id)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={scrollContainerRef} className={`space-y-6 ${isFullPage ? "pt-16 h-screen overflow-auto px-6" : ""}`}>
      <MonitorTopBar
        isFullPage={isFullPage}
        activeCount={activeOrders.length}
        aguardandoCount={filaEspera.length}
        emProducaoCount={emAndamento.length}
        totalGelos={totalGelos}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onToggleFullPage={toggleFullPage}
        refreshCountdown={refreshCountdown}
      />

      {fullscreenPedidoId && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setFullscreenPedidoId(null)} />}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className={`${tv ? "text-2xl" : "text-xl"} font-bold text-foreground`}>Monitor de Produção</h1>
            <p className="text-xs text-muted-foreground">{activeOrders.length} pedido(s) ativo(s) · atualiza em {refreshCountdown}s</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isFullPage && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Desativar alertas" : "Ativar alertas"}>
              {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </Button>
          )}
          <Button
            variant={isFullPage ? "default" : "outline"}
            size="sm"
            onClick={toggleFullPage}
            className="gap-1.5 rounded-xl text-xs font-semibold"
          >
            {isFullPage ? <Minimize2 className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
            {isFullPage ? "Sair" : "Modo TV"}
          </Button>
        </div>
      </div>

      {/* Estoque compacto */}
      {gelos && gelos.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estoque de Gelos</span>
            <Badge variant="outline" className="text-xs font-bold tabular-nums">{totalGelos.toLocaleString()} total</Badge>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...(gelos || [])].filter((g: any) => (g.quantidade || 0) > 0).sort((a: any, b: any) => (b.quantidade || 0) - (a.quantidade || 0)).map((g: any) => (
              <div key={g.id} className="shrink-0 rounded-lg border border-border bg-muted/30 px-3 py-2 text-center min-w-[72px]">
                <p className="text-[10px] font-medium text-muted-foreground truncate leading-tight">{g.sabores?.nome}</p>
                <p className={`${tv ? "text-lg" : "text-sm"} font-bold text-foreground mt-0.5 leading-none tabular-nums`}>{(g.quantidade || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !pedidos?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Monitor className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-semibold">Nenhum pedido pendente</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Pedidos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Em andamento */}
          {emAndamento.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h2 className={`${tv ? "text-lg" : "text-sm"} font-bold text-foreground uppercase tracking-wider`}>Em Andamento</h2>
                <Badge variant="secondary" className="text-xs font-bold">{emAndamento.length}</Badge>
              </div>
              <div className={`grid gap-4 ${tv ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
                {emAndamento.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </section>
          )}

          {/* Fila de espera */}
          {filaEspera.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-accent" />
                <h2 className={`${tv ? "text-lg" : "text-sm"} font-bold text-foreground uppercase tracking-wider`}>Fila de Espera</h2>
                <Badge variant="secondary" className="text-xs font-bold">{filaEspera.length}</Badge>
              </div>
              <div className={`grid gap-4 ${tv ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
                {filaEspera.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </section>
          )}
        </div>
      )}

      <EditPedidoDialog pedido={editPedido} open={!!editPedido} onOpenChange={(open) => { if (!open) setEditPedido(null); }} />
    </div>
  );
}
