import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Monitor, Clock, User, Package, CalendarClock, MessageSquare, Maximize2, Minimize2, CheckCircle2, PackageCheck, Hourglass, HandMetal, Pencil, Smartphone, Volume2, VolumeX } from "lucide-react";
import EditPedidoDialog from "@/components/monitor/EditPedidoDialog";
import MonitorTopBar from "@/components/monitor/MonitorTopBar";
import { useMonitorAlerts } from "@/hooks/useMonitorAlerts";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusOrder = ["aguardando_producao", "em_producao", "separado_para_entrega", "retirado", "enviado"];

const statusLabels: Record<string, string> = {
  aguardando_producao: "AGUARDANDO PRODUÇÃO",
  em_producao: "EM PRODUÇÃO",
  separado_para_entrega: "SEPARADO P/ ENTREGA",
  retirado: "RETIRADO",
  enviado: "ENVIADO",
};

const statusColors: Record<string, string> = {
  aguardando_producao: "bg-amber-500 text-white",
  em_producao: "bg-blue-500 text-white",
  separado_para_entrega: "bg-purple-500 text-white",
  retirado: "bg-orange-500 text-white",
  enviado: "bg-green-500 text-white",
};

const statusBorderColors: Record<string, string> = {
  aguardando_producao: "border-l-amber-500",
  em_producao: "border-l-blue-500",
  separado_para_entrega: "border-l-purple-500",
  retirado: "border-l-orange-500",
  enviado: "border-l-green-500",
};

const SABOR_COLORS: Record<string, string> = {
  melancia: "bg-red-500/90 text-white border-red-600",
  morango: "bg-pink-500/90 text-white border-pink-600",
  "maçã verde": "bg-green-500/90 text-white border-green-600",
  maracujá: "bg-yellow-500/90 text-white border-yellow-600",
  "água de coco": "bg-cyan-500/90 text-white border-cyan-600",
  "abacaxi com hortelã": "bg-emerald-500/90 text-white border-emerald-600",
  "bob marley": "bg-amber-500/90 text-white border-amber-600",
  limão: "bg-lime-500/90 text-white border-lime-600",
  "limão com sal": "bg-lime-600/90 text-white border-lime-700",
  pitaya: "bg-fuchsia-500/90 text-white border-fuchsia-600",
  "blue ice": "bg-blue-500/90 text-white border-blue-600",
};

function getUrgencyLabel(dataEntrega: string) {
  const d = new Date(dataEntrega);
  if (isPast(d)) return { label: "ATRASADO", className: "bg-destructive text-destructive-foreground animate-pulse", type: "atrasado" };
  if (isToday(d)) return { label: "HOJE", className: "bg-destructive/80 text-destructive-foreground animate-pulse", type: "hoje" };
  if (isTomorrow(d)) return { label: "AMANHÃ", className: "bg-amber-500 text-white", type: "amanha" };
  return null;
}

const getSaborColor = (nome: string) => {
  const key = nome?.toLowerCase() || "";
  return SABOR_COLORS[key] || "bg-muted text-foreground border-border";
};

const REFRESH_INTERVAL = 30;
const AUTO_SCROLL_INTERVAL = 8000; // 8 seconds per scroll step

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

    let direction = 1; // 1 = down, -1 = up
    const timer = setInterval(() => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;

      const currentScroll = container.scrollTop;
      if (currentScroll >= maxScroll - 10) direction = -1;
      if (currentScroll <= 10) direction = 1;

      container.scrollBy({ top: direction * container.clientHeight * 0.6, behavior: "smooth" });
    }, AUTO_SCROLL_INTERVAL);

    // Pause on user interaction
    const pause = () => { clearInterval(timer); };
    container.addEventListener("pointerdown", pause, { once: true });

    return () => {
      clearInterval(timer);
      container.removeEventListener("pointerdown", pause);
    };
  }, [isFullPage, fullscreenPedidoId]);

  // Auto-refresh countdown
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
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
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
      const { data, error } = await supabase
        .from("estoque_gelos")
        .select("*, sabores(nome)")
        .order("quantidade", { ascending: false });
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
    const channel = supabase
      .channel("monitor-pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_producao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const toggleFullscreen = (pedidoId: string) => {
    setFullscreenPedidoId(fullscreenPedidoId === pedidoId ? null : pedidoId);
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("pedidos_producao")
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const toggleSeparado = useMutation({
    mutationFn: async ({ itemId, separado }: { itemId: string; separado: boolean }) => {
      const { error } = await (supabase as any)
        .from("pedido_producao_itens")
        .update({ separado })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const activeOrders = pedidos?.filter((p: any) => p.status !== "enviado") || [];
  const filaEspera = pedidos?.filter((p: any) => p.status === "aguardando_producao") || [];
  const emAndamento = pedidos?.filter((p: any) => p.status === "em_producao" || p.status === "separado_para_entrega" || p.status === "retirado") || [];

  const renderMiniQueue = (currentId: string) => {
    const queue = filaEspera.filter((p: any) => p.id !== currentId);
    if (queue.length === 0) return null;
    return (
      <div className="mt-8 border-t border-border pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Hourglass className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold text-foreground">Fila de Espera</span>
          <Badge variant="secondary" className="text-xs">{queue.length}</Badge>
        </div>
        <div className="grid gap-2">
          {queue.map((p: any) => {
            const urg = getUrgencyLabel(p.data_entrega);
            return (
              <div key={p.id} className="flex items-center justify-between bg-muted/50 border border-border rounded-lg px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{p.clientes?.nome}</span>
                  {urg && <Badge className={`${urg.className} text-xs px-2 py-0.5`}>⚠ {urg.label}</Badge>}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{p.pedido_producao_itens?.length || 0} itens</span>
                  <span className="font-medium text-primary">
                    {format(new Date(p.data_entrega), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // TV mode classes
  const tvCard = isFullPage ? "text-lg" : "";
  const tvText = isFullPage ? "text-2xl" : "text-xl";
  const tvBadge = isFullPage ? "text-base px-4 py-1.5" : "text-sm px-3 py-1";
  const tvItemText = isFullPage ? "text-base" : "text-sm";
  const tvQuantity = isFullPage ? "text-2xl" : "text-lg";

  const renderCard = (pedido: any, index: number) => {
    const urgency = getUrgencyLabel(pedido.data_entrega);
    const isExpanded = fullscreenPedidoId === pedido.id;

    // Progress calculation
    const totalItens = pedido.pedido_producao_itens?.length || 0;
    const separadosCount = pedido.pedido_producao_itens?.filter((i: any) => i.separado).length || 0;
    const progressPercent = totalItens > 0 ? Math.round((separadosCount / totalItens) * 100) : 0;

    // Flashing class for urgent orders
    const flashClass = urgency?.type === "atrasado" ? "monitor-card-atrasado" : urgency?.type === "hoje" ? "monitor-card-hoje" : "";

    return (
      <Card
        key={pedido.id}
        className={`border-l-[6px] ${statusBorderColors[pedido.status]} shadow-md animate-fade-in transition-all duration-300 ${flashClass} ${isExpanded ? "fixed inset-0 z-50 border-l-8 rounded-none overflow-auto bg-gradient-to-br from-sky-50 via-blue-50 to-sky-100 dark:from-sky-950 dark:via-blue-950 dark:to-sky-900" : ""} ${tvCard}`}
        style={{ animationDelay: `${index * 80}ms`, ...(isExpanded ? { backgroundImage: "radial-gradient(circle at 20% 50%, rgba(186,230,253,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(147,197,253,0.3) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(186,230,253,0.2) 0%, transparent 50%)" } : {}) }}
      >
        <CardContent className={`p-5 md:p-6 ${isExpanded ? "max-w-4xl mx-auto py-10" : ""}`}>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${statusColors[pedido.status]} ${tvBadge} font-bold tracking-wide`}>
                  {statusLabels[pedido.status]}
                </Badge>
                {urgency && (
                  <Badge className={`${urgency.className} ${tvBadge} font-bold`}>⚠ {urgency.label}</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditPedido(pedido)} className="ml-auto" title="Editar pedido">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleFullscreen(pedido.id)} title="Expandir">
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <User className={`${isFullPage ? "h-6 w-6" : "h-5 w-5"} text-primary shrink-0`} />
                <span className={`${tvText} font-bold text-foreground`}>{pedido.clientes?.nome}</span>
                <div className="flex-1 max-w-[200px] ml-auto flex items-center gap-2">
                  <Progress 
                    value={progressPercent} 
                    className={`h-2.5 ${isFullPage ? "h-3" : ""}`}
                  />
                  <span className={`${isFullPage ? "text-sm" : "text-xs"} font-bold tabular-nums min-w-[36px] text-right ${progressPercent === 100 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className={`flex flex-wrap gap-5 ${isFullPage ? "text-base" : "text-sm"} text-muted-foreground`}>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Pedido: {format(new Date(pedido.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 rounded-md px-2 py-0.5">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    Entrega: {format(new Date(pedido.data_entrega), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  <span>{pedido.tipo_embalagem}</span>
                </div>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <span className={`${isFullPage ? "text-sm" : "text-xs"} font-bold uppercase tracking-wider text-muted-foreground`}>Checklist de Separação</span>
                  <div className="flex items-center gap-2">
                    <span className={`${isFullPage ? "text-sm" : "text-xs"} text-muted-foreground`}>
                      {separadosCount}/{totalItens} itens
                    </span>
                    <Badge className={`bg-primary/10 text-primary border-primary/20 ${isFullPage ? "text-base" : "text-sm"} font-extrabold px-3 py-1`}>
                      Total: {pedido.pedido_producao_itens?.reduce((s: number, i: any) => s + (i.quantidade || 0), 0)} un
                    </Badge>
                  </div>
                </div>
                {pedido.pedido_producao_itens?.map((item: any) => {
                  const isSeparado = item.separado === true;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg px-4 ${isFullPage ? "py-4" : "py-3"} cursor-pointer select-none transition-all border ${
                        isSeparado
                          ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700"
                          : "bg-background border-border hover:border-primary/30"
                      }`}
                      onClick={() => toggleSeparado.mutate({ itemId: item.id, separado: !isSeparado })}
                    >
                      <Checkbox
                        checked={isSeparado}
                        onCheckedChange={(checked) => toggleSeparado.mutate({ itemId: item.id, separado: !!checked })}
                        className={`pointer-events-none ${isFullPage ? "h-6 w-6" : "h-5 w-5"}`}
                      />
                      <span className={`flex-1 ${tvItemText} font-semibold ${isSeparado ? "line-through text-green-700 dark:text-green-400 opacity-60" : "text-foreground"}`}>
                        {item.sabores?.nome}
                      </span>
                      <span className={`${tvQuantity} font-extrabold tabular-nums min-w-[60px] text-right ${isSeparado ? "text-green-600 dark:text-green-400 opacity-60" : "text-primary"}`}>
                        {item.quantidade}
                      </span>
                      <span className={`text-xs ${isSeparado ? "text-green-600/60" : "text-muted-foreground"}`}>un</span>
                      {isSeparado && <CheckCircle2 className={`${isFullPage ? "h-6 w-6" : "h-5 w-5"} text-green-600 dark:text-green-400 shrink-0`} />}
                    </div>
                  );
                })}
              </div>
              {pedido.observacoes && (
                <div className={`flex items-start gap-2 ${tvItemText} p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800`}>
                  <MessageSquare className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                  <span className="text-amber-800 dark:text-amber-200">{pedido.observacoes}</span>
                </div>
              )}
            </div>
            <div className="flex flex-row gap-3 w-full lg:w-auto flex-wrap">
              {pedido.status !== "separado_para_entrega" && pedido.status !== "retirado" && pedido.status !== "enviado" && (
                <Button
                  variant="outline"
                  size="lg"
                  className={`flex-1 gap-2 ${isFullPage ? "h-16 text-lg" : "h-14 text-base"} font-bold border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950`}
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "separado_para_entrega" })}
                >
                  <PackageCheck className="h-5 w-5" /> Separado p/ Entrega
                </Button>
              )}
              {pedido.status !== "retirado" && pedido.status !== "enviado" && (
                <Button
                  variant="outline"
                  size="lg"
                  className={`flex-1 gap-2 ${isFullPage ? "h-16 text-lg" : "h-14 text-base"} font-bold border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950`}
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "retirado" })}
                >
                  <HandMetal className="h-5 w-5" /> Retirado
                </Button>
              )}
              {pedido.status !== "enviado" && (
                <Button
                  size="lg"
                  className={`flex-1 gap-2 ${isFullPage ? "h-16 text-lg" : "h-14 text-base"} font-bold bg-green-600 hover:bg-green-700 text-white`}
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "enviado" })}
                >
                  <CheckCircle2 className="h-5 w-5" /> Enviado
                </Button>
              )}
            </div>
          </div>
          {isExpanded && renderMiniQueue(pedido.id)}
        </CardContent>
      </Card>
    );
  };

  return (
    <div 
      ref={scrollContainerRef}
      className={`space-y-6 ${isFullPage ? "pt-16 h-screen overflow-auto" : ""}`}
    >
      {/* Top bar for TV mode */}
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
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className={`${isFullPage ? "h-8 w-8" : "h-7 w-7"} text-primary`} />
          <h1 className={`${isFullPage ? "text-3xl" : "text-2xl"} font-bold text-foreground`}>Monitor da Produção</h1>
          <Badge variant="secondary" className={`ml-2 ${isFullPage ? "text-lg px-4 py-1.5" : "text-base px-3 py-1"}`}>{activeOrders.length} pedido(s)</Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isFullPage && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums font-mono">{refreshCountdown}s</span>
            </>
          )}
          <Button
            variant={isFullPage ? "default" : "outline"}
            size="sm"
            onClick={toggleFullPage}
            className="gap-2"
            title={isFullPage ? "Sair da tela cheia" : "Tela cheia (rotação automática no celular)"}
          >
            {isFullPage ? <Minimize2 className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            {isFullPage ? "Sair" : "Tela Cheia"}
          </Button>
        </div>
      </div>

      {/* Cards de estoque por sabor */}
      {gelos && gelos.length > 0 && (
        <div>
          <p className={`${isFullPage ? "text-base" : "text-sm"} text-muted-foreground font-medium mb-2`}>Gelos por Sabor</p>
          <div className={`grid ${isFullPage ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2"}`}>
            {[...(gelos || [])]
              .sort((a: any, b: any) => (b.quantidade || 0) - (a.quantidade || 0))
              .map((g: any) => (
                <div
                  key={g.id}
                  className={`rounded-lg border ${isFullPage ? "px-4 py-3" : "px-3 py-2.5"} text-center transition-all hover:scale-[1.03] ${getSaborColor(g.sabores?.nome)}`}
                >
                  <p className={`${isFullPage ? "text-xs" : "text-[11px]"} font-semibold truncate`}>{g.sabores?.nome}</p>
                  <p className={`${isFullPage ? "text-xl" : "text-lg"} font-extrabold mt-0.5`}>{(g.quantidade || 0).toLocaleString()}</p>
                </div>
              ))}
            <div className={`rounded-lg border ${isFullPage ? "px-4 py-3" : "px-3 py-2.5"} text-center transition-all hover:scale-[1.03] bg-gray-700/90 text-white border-gray-800`}>
              <p className={`${isFullPage ? "text-xs" : "text-[11px]"} font-semibold truncate`}>TOTAL</p>
              <p className={`${isFullPage ? "text-xl" : "text-lg"} font-extrabold mt-0.5`}>{totalGelos.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !pedidos?.length ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Monitor className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground text-xl font-medium">Nenhum pedido pendente</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Os pedidos aparecerão aqui automaticamente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {emAndamento.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                <h2 className={`${isFullPage ? "text-xl" : "text-lg"} font-bold text-foreground`}>Em Andamento</h2>
                <Badge variant="secondary">{emAndamento.length}</Badge>
              </div>
              <div className="grid gap-5">
                {emAndamento.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </div>
          )}

          {filaEspera.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Hourglass className="h-5 w-5 text-amber-500" />
                <h2 className={`${isFullPage ? "text-xl" : "text-lg"} font-bold text-foreground`}>Fila de Espera</h2>
                <Badge variant="secondary">{filaEspera.length}</Badge>
              </div>
              <div className="grid gap-5">
                {filaEspera.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </div>
          )}
        </div>
      )}
      <EditPedidoDialog
        pedido={editPedido}
        open={!!editPedido}
        onOpenChange={(open) => { if (!open) setEditPedido(null); }}
      />
    </div>
  );
}
