import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

interface DemandaSaborProps {
  pedidos: any[];
  isFullPage: boolean;
}

export default function DemandaSaborResumo({ pedidos, isFullPage }: DemandaSaborProps) {
  // Aggregate quantities by sabor across all active orders
  const demandaMap: Record<string, { nome: string; quantidade: number }> = {};
  
  for (const pedido of pedidos) {
    for (const item of pedido.pedido_producao_itens || []) {
      const nome = item.sabores?.nome || "Desconhecido";
      if (!demandaMap[nome]) {
        demandaMap[nome] = { nome, quantidade: 0 };
      }
      demandaMap[nome].quantidade += item.quantidade || 0;
    }
  }

  const demandas = Object.values(demandaMap).sort((a, b) => b.quantidade - a.quantidade);
  if (demandas.length === 0) return null;

  const totalDemanda = demandas.reduce((s, d) => s + d.quantidade, 0);
  const maxQtd = demandas[0]?.quantidade || 1;

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className={`${isFullPage ? "h-5 w-5" : "h-4 w-4"} text-primary`} />
        <span className={`${isFullPage ? "text-base" : "text-sm"} font-bold text-foreground`}>Demanda Pendente por Sabor</span>
        <Badge variant="secondary" className={`ml-auto ${isFullPage ? "text-sm" : "text-xs"} font-extrabold`}>
          Total: {totalDemanda.toLocaleString()} un
        </Badge>
      </div>
      <div className={`grid ${isFullPage ? "grid-cols-2 lg:grid-cols-3 gap-2" : "grid-cols-1 sm:grid-cols-2 gap-1.5"}`}>
        {demandas.map((d) => {
          const pct = Math.round((d.quantidade / maxQtd) * 100);
          return (
            <div key={d.nome} className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2 border border-border">
              <span className={`${isFullPage ? "text-sm" : "text-xs"} font-semibold text-foreground truncate min-w-[80px]`}>
                {d.nome}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`${isFullPage ? "text-sm" : "text-xs"} font-extrabold tabular-nums text-primary min-w-[40px] text-right`}>
                {d.quantidade}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
