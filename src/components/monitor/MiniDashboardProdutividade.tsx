import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Package, TrendingUp } from "lucide-react";
import { startOfDay } from "date-fns";

interface ProdutividadeProps {
  isFullPage: boolean;
}

export default function MiniDashboardProdutividade({ isFullPage }: ProdutividadeProps) {
  const hoje = startOfDay(new Date()).toISOString();

  const { data: concluidosHoje } = useQuery({
    queryKey: ["monitor-concluidos-hoje", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_producao")
        .select("id, updated_at, created_at, pedido_producao_itens(quantidade)")
        .eq("status", "enviado")
        .gte("updated_at", hoje);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const pedidosConcluidos = concluidosHoje?.length || 0;
  
  const totalGelosEnviados = (concluidosHoje || []).reduce((sum, p: any) => {
    const itensTotal = (p.pedido_producao_itens || []).reduce((s: number, i: any) => s + (i.quantidade || 0), 0);
    return sum + itensTotal;
  }, 0);

  // Average time from created to completed (rough)
  const tempos = (concluidosHoje || []).map((p: any) => {
    const created = new Date(p.created_at).getTime();
    const updated = new Date(p.updated_at).getTime();
    return updated - created;
  }).filter(t => t > 0);
  
  const tempoMedioMs = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
  const tempoMedioMin = Math.round(tempoMedioMs / 60000);
  const horas = Math.floor(tempoMedioMin / 60);
  const mins = tempoMedioMin % 60;
  const tempoMedioStr = tempoMedioMin > 0 ? (horas > 0 ? `${horas}h${mins.toString().padStart(2, "0")}` : `${mins}min`) : "--";

  if (!isFullPage) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-2">
      <div className="bg-green-950/40 border border-green-800 rounded-xl px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-400" />
        <div>
          <p className="text-xs text-green-400/80 font-medium">Concluídos Hoje</p>
          <p className="text-2xl font-extrabold text-green-400 tabular-nums">{pedidosConcluidos}</p>
        </div>
      </div>
      <div className="bg-blue-950/40 border border-blue-800 rounded-xl px-4 py-3 flex items-center gap-3">
        <Package className="h-6 w-6 text-blue-400" />
        <div>
          <p className="text-xs text-blue-400/80 font-medium">Gelos Finalizados</p>
          <p className="text-2xl font-extrabold text-blue-400 tabular-nums">{totalGelosEnviados.toLocaleString()}</p>
        </div>
      </div>
      <div className="bg-purple-950/40 border border-purple-800 rounded-xl px-4 py-3 flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-purple-400" />
        <div>
          <p className="text-xs text-purple-400/80 font-medium">Tempo Médio</p>
          <p className="text-2xl font-extrabold text-purple-400 tabular-nums">{tempoMedioStr}</p>
        </div>
      </div>
    </div>
  );
}
