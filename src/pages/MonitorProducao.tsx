import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Monitor, Clock, User, Package, CalendarClock, MessageSquare, Maximize2, Minimize2, CheckCircle2, PackageCheck, Hourglass } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusOrder = ["aguardando_producao", "em_producao", "separado_para_entrega", "enviado"];

const statusLabels: Record<string, string> = {
  aguardando_producao: "AGUARDANDO PRODUÇÃO",
  em_producao: "EM PRODUÇÃO",
  separado_para_entrega: "SEPARADO P/ ENTREGA",
  enviado: "ENVIADO",
};

const statusColors: Record<string, string> = {
  aguardando_producao: "bg-amber-500 text-white",
  em_producao: "bg-blue-500 text-white",
  separado_para_entrega: "bg-purple-500 text-white",
  enviado: "bg-green-500 text-white",
};

const statusBorderColors: Record<string, string> = {
  aguardando_producao: "border-l-amber-500",
  em_producao: "border-l-blue-500",
  separado_para_entrega: "border-l-purple-500",
  enviado: "border-l-green-500",
};

function getUrgencyLabel(dataEntrega: string) {
  const d = new Date(dataEntrega);
  if (isPast(d)) return { label: "ATRASADO", className: "bg-destructive text-destructive-foreground animate-pulse" };
  if (isToday(d)) return { label: "HOJE", className: "bg-destructive/80 text-destructive-foreground animate-pulse" };
  if (isTomorrow(d)) return { label: "AMANHÃ", className: "bg-amber-500 text-white" };
  return null;
}

export default function MonitorProducao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["monitor-pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_producao")
        .select("*, clientes(nome), pedido_producao_itens(*, sabores(nome))")
        .in("status", ["aguardando_producao", "em_producao", "separado_para_entrega"])
        .order("data_entrega", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("monitor-pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_producao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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

  const activeOrders = pedidos?.filter((p: any) => p.status !== "enviado") || [];
  const filaEspera = pedidos?.filter((p: any) => p.status === "aguardando_producao") || [];
  const emAndamento = pedidos?.filter((p: any) => p.status === "em_producao" || p.status === "separado_para_entrega") || [];

  const renderCard = (pedido: any, index: number) => {
    const urgency = getUrgencyLabel(pedido.data_entrega);
    return (
      <Card
        key={pedido.id}
        className={`border-l-[6px] ${statusBorderColors[pedido.status]} shadow-md animate-fade-in`}
        style={{ animationDelay: `${index * 80}ms` }}
      >
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${statusColors[pedido.status]} text-sm px-3 py-1 font-bold tracking-wide`}>
                  {statusLabels[pedido.status]}
                </Badge>
                {urgency && (
                  <Badge className={`${urgency.className} text-sm px-3 py-1 font-bold`}>⚠ {urgency.label}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span className="text-xl font-bold text-foreground">{pedido.clientes?.nome}</span>
              </div>
              <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
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
              <div className="flex flex-wrap gap-2">
                {pedido.pedido_producao_itens?.map((item: any) => (
                  <div key={item.id} className="bg-muted border border-border rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2">
                    <span>{item.sabores?.nome}</span>
                    <Badge variant="secondary" className="text-xs font-bold">{item.quantidade} un</Badge>
                  </div>
                ))}
              </div>
              {pedido.observacoes && (
                <div className="flex items-start gap-2 text-sm p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                  <span className="text-amber-800 dark:text-amber-200">{pedido.observacoes}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 min-w-[200px]">
              <Select value={pedido.status} onValueChange={(val) => updateStatus.mutate({ id: pedido.id, status: val })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOrder.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pedido.status === "em_producao" && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950"
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "separado_para_entrega" })}
                >
                  <PackageCheck className="h-4 w-4" /> Separar Pedido
                </Button>
              )}
              {(pedido.status === "em_producao" || pedido.status === "separado_para_entrega") && (
                <Button
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "enviado" })}
                >
                  <CheckCircle2 className="h-4 w-4" /> Concluído / Enviado
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`space-y-6 ${isFullscreen ? "p-6 bg-background min-h-screen" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Monitor da Produção</h1>
          <Badge variant="secondary" className="ml-2 text-base px-3 py-1">{activeOrders.length} pedido(s)</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2">
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}
        </Button>
      </div>

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
          {/* Em andamento */}
          {emAndamento.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-lg font-bold text-foreground">Em Andamento</h2>
                <Badge variant="secondary">{emAndamento.length}</Badge>
              </div>
              <div className="grid gap-5">
                {emAndamento.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </div>
          )}

          {/* Fila de espera */}
          {filaEspera.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Hourglass className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-bold text-foreground">Fila de Espera</h2>
                <Badge variant="secondary">{filaEspera.length}</Badge>
              </div>
              <div className="grid gap-5">
                {filaEspera.map((p: any, i: number) => renderCard(p, i))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
