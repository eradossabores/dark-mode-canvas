import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, Users, Package } from "lucide-react";

interface Props {
  factoryId: string | null;
}

interface Alerta {
  tipo: "estoque" | "conta" | "inatividade";
  titulo: string;
  descricao: string;
  urgencia: "alta" | "media" | "baixa";
}

export default function AlertasInteligentes({ factoryId }: Props) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadAlertas();
  }, [factoryId]);

  async function loadAlertas() {
    setLoading(true);
    const alerts: Alerta[] = [];

    try {
      // 1. Estoque crítico (matéria-prima abaixo do mínimo)
      const { data: mp } = await (supabase as any)
        .from("materias_primas")
        .select("nome, estoque_atual, estoque_minimo")
        .eq("factory_id", factoryId);

      (mp || []).forEach((m: any) => {
        if (m.estoque_atual <= m.estoque_minimo * 0.5) {
          alerts.push({ tipo: "estoque", titulo: `${m.nome} crítico`, descricao: `Estoque: ${m.estoque_atual} (mín: ${m.estoque_minimo})`, urgencia: "alta" });
        } else if (m.estoque_atual <= m.estoque_minimo) {
          alerts.push({ tipo: "estoque", titulo: `${m.nome} baixo`, descricao: `Estoque: ${m.estoque_atual} (mín: ${m.estoque_minimo})`, urgencia: "media" });
        }
      });

      // 2. Contas vencendo nos próximos 3 dias
      const hoje = new Date();
      const tresDias = new Date();
      tresDias.setDate(tresDias.getDate() + 3);

      const { data: contas } = await (supabase as any)
        .from("contas_a_pagar")
        .select("descricao, proxima_parcela_data, valor_parcela")
        .eq("factory_id", factoryId)
        .eq("ativa", true)
        .eq("pago_mes", false)
        .lte("proxima_parcela_data", tresDias.toISOString().split("T")[0])
        .gte("proxima_parcela_data", hoje.toISOString().split("T")[0]);

      (contas || []).forEach((c: any) => {
        const vencimento = new Date(c.proxima_parcela_data);
        const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000);
        alerts.push({
          tipo: "conta",
          titulo: c.descricao,
          descricao: `R$ ${Number(c.valor_parcela).toFixed(2)} - vence em ${diasRestantes}d`,
          urgencia: diasRestantes <= 1 ? "alta" : "media",
        });
      });

      // 3. Clientes inativos >30 dias
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() - 30);

      const { data: clientesInativos } = await (supabase as any)
        .from("clientes")
        .select("nome, ultima_compra")
        .eq("factory_id", factoryId)
        .eq("status", "ativo")
        .lt("ultima_compra", trintaDias.toISOString());

      if ((clientesInativos || []).length > 0) {
        alerts.push({
          tipo: "inatividade",
          titulo: `${clientesInativos.length} clientes inativos`,
          descricao: "Sem compras há mais de 30 dias",
          urgencia: "baixa",
        });
      }
    } catch (e) {
      console.error(e);
    }

    // Sort by urgency
    alerts.sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 };
      return order[a.urgencia] - order[b.urgencia];
    });

    setAlertas(alerts);
    setLoading(false);
  }

  if (loading || alertas.length === 0) return null;

  const icons = { estoque: Package, conta: Clock, inatividade: Users };
  const colors = { alta: "destructive", media: "default", baixa: "secondary" } as const;
  const dotColors = { alta: "bg-destructive", media: "bg-yellow-500", baixa: "bg-muted-foreground" };

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Alertas Inteligentes
          <Badge variant="secondary" className="text-[10px]">{alertas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {alertas.slice(0, 8).map((a, i) => {
            const Icon = icons[a.tipo];
            return (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[a.urgencia]}`} />
                <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{a.titulo}</p>
                  <p className="text-[10px] text-muted-foreground">{a.descricao}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
