import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BellRing, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Alerta {
  id: string;
  tipo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

const TIPO_LABEL: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  vence_hoje: { label: "Vence hoje", variant: "secondary" },
  vencida_1d: { label: "Vencida 1 dia", variant: "destructive" },
  vencida_2d: { label: "Vencida 2 dias", variant: "destructive" },
  convertida: { label: "Convertida → A Prazo", variant: "default" },
  acima_limite: { label: "Acima do limite", variant: "destructive" },
};

export default function AlertasFinanceiros() {
  const { factoryId } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!factoryId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("alertas_financeiros")
      .select("*")
      .eq("factory_id", factoryId)
      .eq("lida", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setAlertas(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [factoryId]);

  async function marcarLida(id: string) {
    await (supabase as any).from("alertas_financeiros").update({ lida: true }).eq("id", id);
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }

  async function marcarTodasLidas() {
    await (supabase as any).from("alertas_financeiros").update({ lida: true }).eq("factory_id", factoryId).eq("lida", false);
    setAlertas([]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BellRing className="h-4 w-4 text-amber-500" /> Alertas Financeiros
          {alertas.length > 0 && <Badge variant="destructive" className="text-[10px]">{alertas.length}</Badge>}
        </CardTitle>
        {alertas.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={marcarTodasLidas}>
            <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : alertas.length === 0 ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCheck className="h-3 w-3" /> Nenhum alerta pendente.</p>
        ) : (
          alertas.map((a) => {
            const meta = TIPO_LABEL[a.tipo] || { label: a.tipo, variant: "outline" as const };
            return (
              <div key={a.id} className="flex items-start gap-2 rounded-md border bg-muted/30 p-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs">{a.mensagem}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => marcarLida(a.id)}>OK</Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}