import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";

const SABOR_COLORS: Record<string, string> = {
  melancia: "#ef4444",
  "maçã verde": "#22c55e",
  morango: "#f43f5e",
  maracujá: "#f59e0b",
  "água de coco": "#06b6d4",
  "bob marley": "#a3e635",
  abacaxi: "#eab308",
  limão: "#84cc16",
  pitaya: "#d946ef",
  "blue ice": "#3b82f6",
};

function getSaborColor(nome: string): string {
  const lower = nome.toLowerCase();
  for (const [key, color] of Object.entries(SABOR_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#8b5cf6";
}

interface ChecklistItem {
  id: string;
  saborId: string;
  saborNome: string;
  loteNumero: number;
  totalLotes: number;
  concluido: boolean;
  horaConclusao?: string;
}

export default function ChecklistProducaoDia() {
  const hojeStr = new Date().toISOString().slice(0, 10);
  const CHECKLIST_KEY = `checklist-producao-${hojeStr}`;

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(CHECKLIST_KEY);
    if (saved) {
      try { setChecklist(JSON.parse(saved)); } catch {}
    }
  }, []);

  function toggleItem(id: string) {
    setChecklist(prev => {
      const updated = prev.map(c =>
        c.id === id ? {
          ...c,
          concluido: !c.concluido,
          horaConclusao: !c.concluido
            ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : undefined
        } : c
      );
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  if (checklist.length === 0) return null;

  const concluidos = checklist.filter(c => c.concluido).length;
  const total = checklist.length;
  const progress = Math.round((concluidos / total) * 100);
  const completo = concluidos === total;

  // Group by sabor
  const saboresUnicos = [...new Set(checklist.map(c => c.saborId))];

  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-3">
        {/* Header */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Checklist de Produção — Hoje</span>
            <Badge
              variant={completo ? "default" : "secondary"}
              className="text-[10px]"
              style={completo ? { backgroundColor: "#22c55e" } : {}}
            >
              {concluidos}/{total} lotes
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Mini progress bar */}
            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: completo ? "#22c55e" : "hsl(var(--primary))",
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono">{progress}%</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Checklist items */}
        {expanded && (
          <div className="mt-3 space-y-2">
            {saboresUnicos.map(saborId => {
              const itens = checklist.filter(c => c.saborId === saborId);
              const nome = itens[0]?.saborNome || "";
              const color = getSaborColor(nome);
              const saborConcluidos = itens.filter(c => c.concluido).length;
              const todosOk = saborConcluidos === itens.length;

              return (
                <div key={saborId} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className={`text-xs font-bold ${todosOk ? "line-through text-muted-foreground" : ""}`}>
                      {nome}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {saborConcluidos}/{itens.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-5">
                    {itens.map(item => (
                      <Button
                        key={item.id}
                        variant={item.concluido ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs gap-1 transition-all duration-200 ${
                          item.concluido ? "shadow-sm" : ""
                        }`}
                        style={item.concluido ? { backgroundColor: color, borderColor: color } : { borderColor: `${color}50` }}
                        onClick={() => toggleItem(item.id)}
                      >
                        {item.concluido && <Check className="h-3 w-3" />}
                        Lote {item.loteNumero}
                        {item.concluido && item.horaConclusao && (
                          <span className="text-[9px] opacity-80 ml-0.5">{item.horaConclusao}</span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}

            {completo && (
              <div className="text-center py-2 text-xs text-green-600 font-semibold">
                ✅ Produção do dia concluída!
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
