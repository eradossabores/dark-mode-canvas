import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ClipboardList, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

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
  // Usar data local (não UTC) para evitar problemas de fuso horário
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const CONCLUIDOS_KEY = `checklist-concluidos-${hojeStr}`;

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDecisoes();
  }, []);

  async function fetchDecisoes() {
    setLoading(true);
    try {
      // Buscar decisões autorizadas de hoje da tabela decisoes_producao
      // Usar range amplo para cobrir fusos horários (Brasil UTC-3)
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

      if (!data || data.length === 0) {
        setChecklist([]);
        setLoading(false);
        return;
      }

      // Recuperar estado de conclusão do localStorage
      let concluidos: Record<string, string> = {};
      try {
        const saved = localStorage.getItem(CONCLUIDOS_KEY);
        if (saved) concluidos = JSON.parse(saved);
      } catch {}

      // Gerar checklist items a partir das decisões do banco
      const items: ChecklistItem[] = [];
      data.forEach((decisao: any) => {
        for (let l = 1; l <= decisao.lotes_autorizados; l++) {
          const itemId = `${decisao.sabor_id}-${l}`;
          items.push({
            id: itemId,
            saborId: decisao.sabor_id,
            saborNome: decisao.sabor_nome,
            loteNumero: l,
            totalLotes: decisao.lotes_autorizados,
            concluido: !!concluidos[itemId],
            horaConclusao: concluidos[itemId] || undefined,
          });
        }
      });

      setChecklist(items);
    } catch (e) {
      console.error("Erro ao carregar checklist:", e);
    } finally {
      setLoading(false);
    }
  }

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

      // Salvar apenas os concluídos no localStorage
      const concluidos: Record<string, string> = {};
      updated.forEach(item => {
        if (item.concluido && item.horaConclusao) {
          concluidos[item.id] = item.horaConclusao;
        }
      });
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

  const concluidos = checklist.filter(c => c.concluido).length;
  const total = checklist.length;
  const progress = Math.round((concluidos / total) * 100);
  const completo = concluidos === total;

  const saboresUnicos = [...new Set(checklist.map(c => c.saborId))];

  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-3">
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
