import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Monitor, Clock, User, Package, CalendarClock, MessageSquare } from "lucide-react";
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
  if (isPast(d)) return { label: "ATRASADO", className: "bg-destructive text-destructive-foreground" };
  if (isToday(d)) return { label: "HOJE", className: "bg-destructive/80 text-destructive-foreground" };
  if (isTomorrow(d)) return { label: "AMANHÃ", className: "bg-amber-500 text-white" };
  return null;
}

export default function MonitorProducao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("monitor-pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_producao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["monitor-pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Monitor da Produção</h1>
        <Badge variant="secondary" className="ml-2">{activeOrders.length} pedido(s)</Badge>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !pedidos?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Monitor className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-lg">Nenhum pedido pendente no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pedidos.map((pedido: any) => {
            const urgency = getUrgencyLabel(pedido.data_entrega);
            return (
              <Card
                key={pedido.id}
                className={`border-l-4 ${statusBorderColors[pedido.status]} shadow-sm`}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Order info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={statusColors[pedido.status]}>
                          {statusLabels[pedido.status]}
                        </Badge>
                        {urgency && (
                          <Badge className={urgency.className}>{urgency.label}</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-bold text-foreground">{pedido.clientes?.nome}</span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Pedido: {format(new Date(pedido.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          <span className="font-semibold text-foreground">
                            Entrega: {format(new Date(pedido.data_entrega), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          <span>{pedido.tipo_embalagem}</span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pedido.pedido_producao_itens?.map((item: any) => (
                          <div
                            key={item.id}
                            className="bg-muted rounded-md px-3 py-1.5 text-sm font-medium"
                          >
                            {item.sabores?.nome}: <span className="font-bold">{item.quantidade} un</span>
                          </div>
                        ))}
                      </div>

                      {pedido.observacoes && (
                        <div className="flex items-start gap-1.5 text-sm mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                          <MessageSquare className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                          <span className="text-amber-800 dark:text-amber-200">{pedido.observacoes}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Status control */}
                    <div className="flex flex-col gap-2 min-w-[180px]">
                      <Select
                        value={pedido.status}
                        onValueChange={(val) => updateStatus.mutate({ id: pedido.id, status: val })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOrder.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
