import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

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
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const CONCLUIDOS_KEY = `checklist-concluidos-${hojeStr}`;

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDecisoes(); }, []);

  async function fetchDecisoes() {
    setLoading(true);
    try {
      const inicioHoje = `${hojeStr}T00:00:00-03:00`;
      const fimHoje = `${hojeStr}T23:59:59-03:00`;

      const { data, error } = await (supabase as any)
        .from("decisoes_producao")
        .select("*")
        .gte("created_at", inicioHoje)
        .lte("created_at", fimHoje)
        .gt("lotes_autorizados", 0)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) { setChecklist([]); setLoading(false); return; }

      let concluidos: Record<string, string> = {};
      try { const saved = localStorage.getItem(CONCLUIDOS_KEY); if (saved) concluidos = JSON.parse(saved); } catch {}

      const items: ChecklistItem[] = [];
      data.forEach((decisao: any) => {
        for (let l = 1; l <= decisao.lotes_autorizados; l++) {
          const itemId = `${decisao.sabor_id}-${l}`;
          items.push({
            id: itemId, saborId: decisao.sabor_id, saborNome: decisao.sabor_nome,
            loteNumero: l, totalLotes: decisao.lotes_autorizados,
            concluido: !!concluidos[itemId], horaConclusao: concluidos[itemId] || undefined,
          });
        }
      });
      setChecklist(items);
    } catch (e) { console.error("Erro ao carregar checklist:", e); }
    finally { setLoading(false); }
  }

  function toggleItem(id: string) {
    setChecklist(prev => {
      const updated = prev.map(c =>
        c.id === id ? {
          ...c, concluido: !c.concluido,
          horaConclusao: !c.concluido ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined
        } : c
      );
      const concluidos: Record<string, string> = {};
      updated.forEach(item => { if (item.concluido && item.horaConclusao) concluidos[item.id] = item.horaConclusao; });
      localStorage.setItem(CONCLUIDOS_KEY, JSON.stringify(concluidos));
      return updated;
    });
  }

  function toggleSabor(saborId: string) {
    setChecklist(prev => {
      const saborItens = prev.filter(c => c.saborId === saborId);
      const allDone = saborItens.every(c => c.concluido);
      const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const updated = prev.map(c =>
        c.saborId === saborId ? { ...c, concluido: !allDone, horaConclusao: !allDone ? now : undefined } : c
      );
      const concluidos: Record<string, string> = {};
      updated.forEach(item => { if (item.concluido && item.horaConclusao) concluidos[item.id] = item.horaConclusao; });
      localStorage.setItem(CONCLUIDOS_KEY, JSON.stringify(concluidos));
      return updated;
    });
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-4 pb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklist...
        </CardContent>
      </Card>
    );
  }

  if (checklist.length === 0) return null;

  const saboresUnicos = [...new Set(checklist.map(c => c.saborId))];
  const totalConcluidos = checklist.filter(c => c.concluido).length;
  const completo = totalConcluidos === checklist.length;

  return (
    <div className="mb-6 space-y-3">
      {completo && (
        <div className="text-center py-3 text-sm text-green-600 font-semibold rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          ✅ Produção do dia concluída!
        </div>
      )}

      {saboresUnicos.map(saborId => {
        const itens = checklist.filter(c => c.saborId === saborId);
        const nome = itens[0]?.saborNome || "";
        const color = getSaborColor(nome);
        const saborConcluidos = itens.filter(c => c.concluido).length;
        const todosOk = saborConcluidos === itens.length;

        return (
          <div
            key={saborId}
            className="rounded-xl border bg-card overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 4, borderLeftColor: color }}
          >
            {/* Sabor header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleSabor(saborId)}
            >
              <div className="flex items-center gap-3">
                <CircleCheck checked={todosOk} color={color} />
                <span className={`font-semibold text-sm ${todosOk ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {nome}
                </span>
              </div>
              <Badge
                variant="secondary"
                className="text-xs font-bold"
                style={todosOk ? { backgroundColor: `${color}20`, color } : {}}
              >
                {saborConcluidos}/{itens.length} lotes
              </Badge>
            </div>

            {/* Lote items */}
            <div className="px-4 pb-3 space-y-1.5">
              {itens.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                    item.concluido
                      ? "bg-green-50 dark:bg-green-950/20"
                      : "bg-muted/40 hover:bg-muted/60"
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <CircleCheck checked={item.concluido} color={color} size="sm" />
                  <span className={`text-sm font-medium ${item.concluido ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    Lote {item.loteNumero}
                  </span>
                  <span className="text-xs text-muted-foreground">84 unidades</span>
                  {item.concluido && item.horaConclusao && (
                    <span className="ml-auto text-[10px] text-green-600 font-mono">{item.horaConclusao}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CircleCheck({ checked, color, size = "md" }: { checked: boolean; color: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? 22 : 28;
  const r = dim / 2 - 2;
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="shrink-0">
      <circle
        cx={dim / 2} cy={dim / 2} r={r}
        fill={checked ? color : "transparent"}
        stroke={checked ? color : "hsl(var(--border))"}
        strokeWidth={2}
      />
      {checked && (
        <polyline
          points={size === "sm" ? "7,11 10,14 15,8" : "8,14 12,18 20,10"}
          fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
