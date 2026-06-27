import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompraTransito {
  id: string;
  item_nome: string;
  quantidade: number;
  unidade: string | null;
  created_at: string;
  data_prevista_chegada: string | null;
  transportadora: string | null;
  status_recebimento: string | null;
}

export default function AlertasComprasTransito() {
  const { factoryId } = useAuth();
  const [items, setItems] = useState<CompraTransito[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("compras")
        .select("id,item_nome,quantidade,unidade,created_at,data_prevista_chegada,transportadora,status_recebimento")
        .eq("factory_id", factoryId)
        .in("status_recebimento", ["pendente", "recebido_parcial"])
        .order("created_at", { ascending: true });
      setItems(data || []);
      setLoading(false);
    })();
  }, [factoryId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-500" /> Compras em Trânsito
          {items.length > 0 && <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Nenhuma compra em trânsito.
          </p>
        ) : (
          items.map((c) => {
            const dias = differenceInDays(new Date(), new Date(c.created_at));
            const atrasada = dias > 20;
            return (
              <div key={c.id} className={`flex items-start gap-2 rounded-md border p-2 ${atrasada ? "bg-destructive/10 border-destructive/30" : "bg-muted/30"}`}>
                {atrasada ? <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> : <Truck className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={atrasada ? "destructive" : "outline"} className="text-[10px]">{dias}d</Badge>
                    {c.status_recebimento === "recebido_parcial" && (
                      <Badge variant="secondary" className="text-[10px]">Parcial</Badge>
                    )}
                    {c.data_prevista_chegada && (
                      <span className="text-[10px] text-muted-foreground">
                        Prev: {format(new Date(c.data_prevista_chegada + "T12:00:00"), "dd/MM", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium truncate">{c.item_nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {Number(c.quantidade).toLocaleString("pt-BR")} {c.unidade || "un"}
                    {c.transportadora ? ` · ${c.transportadora}` : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}