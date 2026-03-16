import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Monitor, Clock, User, Package, CalendarClock, MessageSquare, Maximize2, Minimize2, CheckCircle2, PackageCheck, Hourglass, HandMetal, Pencil, Smartphone, Volume2, VolumeX, Printer, Timer, AlertTriangle, Trash2, Globe, ThumbsUp, ThumbsDown, MapPin, Phone, CreditCard } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
    .map((i: any) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:14px">${i.sabores?.nome || "-"}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;font-size:16px">${i.quantidade}</td></tr>`)
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
    <table><thead><tr><th style="padding:6px 10px;text-align:left;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;letter-spacing:1px">Sabor</th><th style="padding:6px 10px;text-align:right;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;letter-spacing:1px">Qtd</th></tr></thead><tbody>${itens}</tbody></table>
    <p class="total">Total: ${totalUn} unidades</p>
    <script>window.onload=()=>{window.print()}</script></body></html>`;
  const win = window.open("", "_blank", "width=420,height=600");
  if (win) { win.document.write(html); win.document.close(); }
}

const statusLabels: Record<string, string> = {
  aguardando_producao: "AGUARDANDO",
  em_producao: "EM PRODUÇÃO",
  separado_para_entrega: "SEPARADO P/ ENTREGA",
  retirado: "SEPARADO P/ RETIRADA",
  enviado: "FINALIZADO",
};

const statusHeaderColors: Record<string, string> = {
  aguardando_producao: "from-amber-500 to-orange-500",
  em_producao: "from-blue-500 to-indigo-600",
  separado_para_entrega: "from-violet-500 to-purple-600",
  retirado: "from-orange-500 to-red-500",
  enviado: "from-emerald-500 to-green-600",
};

const statusGlowColors: Record<string, string> = {
  aguardando_producao: "shadow-amber-500/20",
  em_producao: "shadow-blue-500/20",
  separado_para_entrega: "shadow-purple-500/20",
  retirado: "shadow-orange-500/20",
  enviado: "shadow-green-500/20",
};

const SABOR_DOT_COLORS: Record<string, string> = {
  melancia: "bg-red-500",
  morango: "bg-pink-500",
  "maçã verde": "bg-green-500",
  maracujá: "bg-yellow-500",
  "água de coco": "bg-cyan-400",
  "abacaxi com hortelã": "bg-emerald-500",
  "bob marley": "bg-amber-600",
  limão: "bg-lime-500",
  "limão com sal": "bg-lime-600",
  pitaya: "bg-fuchsia-500",
  "blue ice": "bg-blue-400",
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
  if (isPast(d)) return { label: "ATRASADO", type: "atrasado" };
  if (isToday(d)) return { label: "HOJE", type: "hoje" };
  if (isTomorrow(d)) return { label: "AMANHÃ", type: "amanha" };
  return null;
}

const getSaborColor = (nome: string) => {
  const key = nome?.toLowerCase() || "";
  return SABOR_COLORS[key] || "bg-muted text-foreground border-border";
};

const getSaborDot = (nome: string) => {
  const key = nome?.toLowerCase() || "";
  return SABOR_DOT_COLORS[key] || "bg-muted-foreground";
};

const REFRESH_INTERVAL = 30;
const AUTO_SCROLL_INTERVAL = 8000;

export default function MonitorProducao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullscreenPedidoId, setFullscreenPedidoId] = useState<string | null>(null);
  const [editPedido, setEditPedido] = useState<any>(null);
  const [isFullPage, setIsFullPage] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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
          queryClient.invalidateQueries({ queryKey: ["monitor-pedidos-publicos"] });
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

  // Public portal orders
  const { data: pedidosPublicos } = useQuery({
    queryKey: ["monitor-pedidos-publicos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos_publicos")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useMonitorAlerts(pedidos, soundEnabled);
  const totalGelos = (gelos || []).reduce((s: number, g: any) => s + (g.quantidade || 0), 0);

  useEffect(() => {
    const channel = supabase.channel("monitor-pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_producao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_publicos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["monitor-pedidos-publicos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Approve public order → create client + pedido_producao
  const approvePublicOrder = useMutation({
    mutationFn: async (order: any) => {
      // 1. Find or create client by phone
      let clienteId: string;
      const { data: existingClient } = await supabase
        .from("clientes")
        .select("id")
        .eq("telefone", order.telefone)
        .maybeSingle();

      if (existingClient) {
        clienteId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            nome: order.nome_cliente,
            telefone: order.telefone,
            endereco: order.endereco,
            bairro: order.bairro,
          })
          .select("id")
          .single();
        if (clientError) throw clientError;
        clienteId = newClient.id;
      }

      // 2. Create pedido_producao
      const now = new Date();
      now.setHours(now.getHours() + 2); // default delivery in 2h
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos_producao")
        .insert({
          cliente_id: clienteId,
          data_entrega: now.toISOString(),
          operador: "portal",
          observacoes: `🌐 Portal | ${order.forma_pagamento?.toUpperCase()} | ${order.endereco}, ${order.bairro}${order.observacoes ? ` | ${order.observacoes}` : ""}`,
          tipo_pedido: "entrega",
          status: "aguardando_producao",
          status_pagamento: order.forma_pagamento === "fiado" ? "fiado" : "aguardando_pagamento",
        } as any)
        .select("id")
        .single();
      if (pedidoError) throw pedidoError;

      // 3. Create pedido items
      const itens = order.itens || [];
      for (const item of itens) {
        await (supabase as any).from("pedido_producao_itens").insert({
          pedido_id: pedido.id,
          sabor_id: item.sabor_id,
          quantidade: item.quantidade,
        });
      }

      // 4. Mark public order as approved
      await (supabase as any)
        .from("pedidos_publicos")
        .update({ status: "aprovado" })
        .eq("id", order.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos-publicos"] });
      toast({ title: "✅ Pedido aprovado!", description: "Criado no monitor para separação." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
    },
  });

  const rejectPublicOrder = useMutation({
    mutationFn: async (orderId: string) => {
      await (supabase as any)
        .from("pedidos_publicos")
        .update({ status: "rejeitado" })
        .eq("id", orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos-publicos"] });
      toast({ title: "Pedido recusado" });
    },
  });

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pedido_producao_itens").delete().eq("pedido_id", id);
      const { error } = await supabase.from("pedidos_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao"] });
      toast({ title: "Pedido excluído!" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
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
          <div className="max-w-3xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => setFullscreenPedidoId(null)} className="mb-4">
              <Minimize2 className="h-4 w-4 mr-2" /> Fechar
            </Button>
            {renderCardInner(pedido, urgency, totalItens, separadosCount, progressPercent, totalUn, false)}
          </div>
        </div>
      );
    }

    return (
      <div
        key={pedido.id}
        className={`animate-fade-in ${flashClass}`}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        {renderCardInner(pedido, urgency, totalItens, separadosCount, progressPercent, totalUn, true)}
      </div>
    );
  };

  const renderCardInner = (pedido: any, urgency: any, totalItens: number, separadosCount: number, progressPercent: number, totalUn: number, compact: boolean) => {
    const gradient = statusHeaderColors[pedido.status] || "from-gray-500 to-gray-600";
    const glow = statusGlowColors[pedido.status] || "";

    return (
      <div className={`rounded-2xl overflow-hidden shadow-lg ${glow} shadow-xl bg-card border border-border/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5`}>
        {/* === Header band === */}
        <div className={`bg-gradient-to-r ${gradient} px-5 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className={`font-black text-white ${tv ? "text-lg" : "text-sm"} tracking-widest uppercase`}>
              {statusLabels[pedido.status]}
            </span>
            {urgency && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                urgency.type === "atrasado" ? "bg-white/20 text-white animate-pulse" : 
                urgency.type === "hoje" ? "bg-white/20 text-white animate-pulse" : 
                "bg-white/15 text-white/90"
              }`}>
                <AlertTriangle className="h-3 w-3" />
                {urgency.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20" onClick={() => setEditPedido(pedido)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20" onClick={() => handlePrintPedido(pedido)}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20" onClick={() => setFullscreenPedidoId(pedido.id)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-red-500/30" onClick={() => setDeleteId(pedido.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* === Client + meta === */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className={`${tv ? "text-xl" : "text-base"} font-extrabold text-foreground leading-tight`}>
                  {pedido.clientes?.nome}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Timer className="h-3 w-3" /> há {getElapsedTime(pedido.created_at)}
                  </span>
                </div>
              </div>
            </div>
            {/* Progress ring */}
            <div className="flex items-center gap-2">
              <div className="relative w-11 h-11">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="3" />
                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor"
                    className={progressPercent === 100 ? "text-green-500" : "text-primary"}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(progressPercent / 100) * 113} 113`}
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-extrabold ${progressPercent === 100 ? "text-green-500" : "text-foreground"}`}>
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1 mb-3">
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold text-primary">{format(new Date(pedido.data_entrega), "dd/MM HH:mm", { locale: ptBR })}</span>
            </span>
            {pedido.tipo_pedido && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                pedido.tipo_pedido === "entrega"
                  ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700"
                  : "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
              }`}>
                {pedido.tipo_pedido === "entrega" ? "🚚 Entrega" : "🧊 Retirada"}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> {pedido.tipo_embalagem}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {format(new Date(pedido.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div className="flex items-start gap-2 text-xs p-2.5 mb-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
              <span className="text-amber-700 dark:text-amber-300">{pedido.observacoes}</span>
            </div>
          )}

          {/* === Checklist === */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Separação · {separadosCount}/{totalItens}
              </span>
              <span className={`text-xs font-extrabold ${tv ? "text-sm" : ""} bg-primary/10 text-primary px-2.5 py-0.5 rounded-full`}>
                {totalUn} un
              </span>
            </div>
            {pedido.pedido_producao_itens?.map((item: any) => {
              const isSeparado = item.separado === true;
              const dotColor = getSaborDot(item.sabores?.nome);
              return (
                <div
                  key={item.id}
                  className={`group flex items-center gap-3 rounded-xl px-3 ${tv ? "py-3" : "py-2.5"} cursor-pointer select-none transition-all duration-200 ${
                    isSeparado
                      ? "bg-green-500/10 dark:bg-green-500/5"
                      : "bg-muted/30 hover:bg-muted/60"
                  }`}
                  onClick={() => toggleSeparado.mutate({ itemId: item.id, separado: !isSeparado })}
                >
                  <Checkbox
                    checked={isSeparado}
                    onCheckedChange={(checked) => toggleSeparado.mutate({ itemId: item.id, separado: !!checked })}
                    className={`pointer-events-none ${tv ? "h-5 w-5" : "h-4 w-4"} rounded-full`}
                  />
                  <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                  <span className={`flex-1 ${tv ? "text-sm" : "text-[13px]"} font-semibold transition-all ${
                    isSeparado ? "line-through text-muted-foreground/50" : "text-foreground"
                  }`}>
                    {item.sabores?.nome}
                  </span>
                  <span className={`${tv ? "text-xl" : "text-lg"} font-black tabular-nums transition-all ${
                    isSeparado ? "text-green-500/40" : "text-foreground"
                  }`}>
                    {item.quantidade}
                  </span>
                  {isSeparado && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* === Action bar === */}
        <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex items-center gap-2">
          {pedido.status !== "separado_para_entrega" && pedido.status !== "retirado" && pedido.status !== "enviado" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 font-bold text-xs border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950 rounded-xl h-9"
              onClick={() => updateStatus.mutate({ id: pedido.id, status: "separado_para_entrega" })}
            >
              <PackageCheck className="h-3.5 w-3.5" /> Entrega
            </Button>
          )}
          {pedido.status !== "retirado" && pedido.status !== "enviado" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 font-bold text-xs border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950 rounded-xl h-9"
              onClick={() => updateStatus.mutate({ id: pedido.id, status: "retirado" })}
            >
              <HandMetal className="h-3.5 w-3.5" /> Retirada
            </Button>
          )}
          {pedido.status !== "enviado" && (
            <Button
              size="sm"
              className="flex-1 gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9"
              onClick={() => updateStatus.mutate({ id: pedido.id, status: "enviado" })}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={scrollContainerRef} className={`space-y-5 ${isFullPage ? "pt-16 h-screen overflow-auto px-4" : ""}`}>
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Monitor className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className={`${tv ? "text-2xl" : "text-xl"} font-extrabold text-foreground leading-tight`}>Monitor</h1>
            <p className="text-xs text-muted-foreground">{activeOrders.length} pedido(s) ativo(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isFullPage && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"}>
                {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono bg-muted px-2 py-1 rounded-full">{refreshCountdown}s</span>
            </>
          )}
          <Button
            variant={isFullPage ? "default" : "outline"}
            size="sm"
            onClick={toggleFullPage}
            className="gap-1.5 rounded-xl text-xs font-bold"
          >
            {isFullPage ? <Minimize2 className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
            {isFullPage ? "Sair" : "TV"}
          </Button>
        </div>
      </div>

      {/* Estoque por sabor — compact horizontal scroll (hide zero quantities) */}
      {gelos && gelos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...(gelos || [])].filter((g: any) => (g.quantidade || 0) > 0).sort((a: any, b: any) => (b.quantidade || 0) - (a.quantidade || 0)).map((g: any) => (
            <div key={g.id} className={`shrink-0 rounded-xl border px-3 py-2 text-center min-w-[72px] ${getSaborColor(g.sabores?.nome)}`}>
              <p className="text-[10px] font-semibold truncate leading-tight">{g.sabores?.nome}</p>
              <p className={`${tv ? "text-lg" : "text-base"} font-black mt-0.5 leading-none`}>{(g.quantidade || 0).toLocaleString()}</p>
            </div>
          ))}
          <div className="shrink-0 rounded-xl border px-3 py-2 text-center min-w-[72px] bg-foreground/90 text-background border-foreground/80">
            <p className="text-[10px] font-semibold truncate leading-tight">TOTAL</p>
            <p className={`${tv ? "text-lg" : "text-base"} font-black mt-0.5 leading-none`}>{totalGelos.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* 🌐 Portal Orders - Pending Approval */}
      {(pedidosPublicos || []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Globe className="h-4 w-4 text-cyan-500" />
            <h2 className={`${tv ? "text-lg" : "text-base"} font-bold text-foreground`}>Pedidos do Portal</h2>
            <span className="text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full animate-pulse">
              {(pedidosPublicos || []).length} novo(s)
            </span>
          </div>
          <div className={`grid gap-4 ${tv ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
            {(pedidosPublicos || []).map((order: any, i: number) => {
              const pagLabels: Record<string, string> = { dinheiro: "💵 Dinheiro", pix: "📱 PIX", cartao: "💳 Cartão", fiado: "📝 A Prazo" };
              const itens = order.itens || [];
              return (
                <div key={order.id} className="rounded-2xl overflow-hidden shadow-lg shadow-cyan-500/10 bg-card border border-cyan-500/30 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-white" />
                      <span className="font-black text-white text-sm tracking-widest uppercase">🌐 PORTAL</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-white/80 font-medium mr-1">
                        {formatDistanceToNow(new Date(order.created_at), { locale: ptBR, addSuffix: true })}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20" onClick={() => {
                        const itens = (order.itens || []).map((item: any) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:14px">${item.nome}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;font-size:16px">${item.quantidade}</td></tr>`).join("");
                        const html = `<html><head><title>Pedido Portal - ${order.nome_cliente}</title><style>body{font-family:system-ui,sans-serif;padding:20px;max-width:380px;margin:0 auto}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}.meta{color:#666;font-size:13px;margin:4px 0}.total{font-size:18px;font-weight:bold;margin-top:8px}@media print{body{padding:10px}}</style></head><body><h2>🌐 ${order.nome_cliente}</h2><p class="meta">📞 ${order.telefone}</p><p class="meta">📍 ${order.endereco}, ${order.bairro}</p><p class="meta">💰 ${order.forma_pagamento}</p>${order.observacoes ? `<p class="meta" style="color:#b45309">⚠ ${order.observacoes}</p>` : ""}<table><thead><tr><th style="padding:6px 10px;text-align:left;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;letter-spacing:1px">Sabor</th><th style="padding:6px 10px;text-align:right;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;letter-spacing:1px">Qtd</th></tr></thead><tbody>${itens}</tbody></table><p class="total">Total: ${order.total_itens} un · R$ ${Number(order.valor_total).toFixed(2)}</p><script>window.onload=()=>{window.print()}</script></body></html>`;
                        const win = window.open("", "_blank", "width=420,height=600");
                        if (win) { win.document.write(html); win.document.close(); }
                      }}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-red-500/30" onClick={() => rejectPublicOrder.mutate(order.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="px-5 pt-4 pb-3">
                    {/* Client info */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className={`${tv ? "text-xl" : "text-base"} font-extrabold text-foreground leading-tight`}>
                          {order.nome_cliente}
                        </h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {order.telefone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Address & payment */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-cyan-500" /> {order.endereco}, {order.bairro}</span>
                      <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {pagLabels[order.forma_pagamento] || order.forma_pagamento}</span>
                    </div>

                    {order.observacoes && (
                      <div className="flex items-start gap-2 text-xs p-2.5 mb-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                        <span className="text-amber-700 dark:text-amber-300">{order.observacoes}</span>
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Itens</span>
                        <span className="text-xs font-extrabold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2.5 py-0.5 rounded-full">
                          {order.total_itens} un · R$ {Number(order.valor_total).toFixed(2)}
                        </span>
                      </div>
                      {itens.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-muted/30">
                          <div className={`w-2 h-2 rounded-full ${getSaborDot(item.nome)} shrink-0`} />
                          <span className="flex-1 text-[13px] font-semibold text-foreground">{item.nome}</span>
                          <span className="text-lg font-black tabular-nums text-foreground">{item.quantidade}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Approval actions */}
                  <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9"
                      onClick={() => approvePublicOrder.mutate(order)}
                      disabled={approvePublicOrder.isPending}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 font-bold text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950 rounded-xl h-9"
                      onClick={() => rejectPublicOrder.mutate(order.id)}
                      disabled={rejectPublicOrder.isPending}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> Recusar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !pedidos?.length && !(pedidosPublicos || []).length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Monitor className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground text-lg font-semibold">Nenhum pedido pendente</p>
          <p className="text-muted-foreground/50 text-sm mt-1">Os pedidos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Em andamento */}
          {emAndamento.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h2 className={`${tv ? "text-lg" : "text-base"} font-bold text-foreground`}>Em Andamento</h2>
                <span className="text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">{emAndamento.length}</span>
              </div>
              <div className={`grid gap-4 ${tv ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
                {emAndamento.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </div>
          )}

          {/* Fila de espera */}
          {filaEspera.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Hourglass className="h-4 w-4 text-amber-500" />
                <h2 className={`${tv ? "text-lg" : "text-base"} font-bold text-foreground`}>Fila de Espera</h2>
                <span className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">{filaEspera.length}</span>
              </div>
              <div className={`grid gap-4 ${tv ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
                {filaEspera.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </div>
          )}
        </div>
      )}

      <EditPedidoDialog pedido={editPedido} open={!!editPedido} onOpenChange={(open) => { if (!open) setEditPedido(null); }} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O pedido e todos os seus itens serão removidos permanentemente do monitor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
