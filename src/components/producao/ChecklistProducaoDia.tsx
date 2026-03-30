import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, PartyPopper } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

/* ─── Progress Ring SVG ─── */
function ProgressRing({ progress, color, size = 48, strokeWidth = 4, children }: {
  progress: number; color: string; size?: number; strokeWidth?: number; children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ─── Circle Checkbox ─── */
function CircleCheck({ checked, color, size = "md" }: { checked: boolean; color: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? 22 : 28;
  const r = dim / 2 - 2;
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="shrink-0">
      <circle cx={dim / 2} cy={dim / 2} r={r} fill={checked ? color : "transparent"} stroke={checked ? color : "hsl(var(--border))"} strokeWidth={2} className="transition-all duration-300" />
      {checked && (
        <polyline points={size === "sm" ? "7,11 10,14 15,8" : "8,14 12,18 20,10"} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="animate-scale-in" />
      )}
    </svg>
  );
}

/* ─── Celebration: Confetti + Fireworks ─── */
function Celebration() {
  const confetti = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 4 + Math.random() * 8,
      color: ["#ef4444", "#22c55e", "#f59e0b", "#3b82f6", "#d946ef", "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#a855f7"][i % 10],
      rotation: Math.random() * 360,
      sway: (Math.random() - 0.5) * 120,
      type: Math.random() > 0.5 ? "rect" : "circle",
    }))
  , []);

  const fireworks = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,
      y: 20 + Math.random() * 40,
      delay: i * 0.8 + Math.random() * 0.5,
      sparks: Array.from({ length: 12 }, (_, j) => ({
        id: j,
        angle: (j / 12) * 360,
        distance: 30 + Math.random() * 50,
        color: ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#d946ef", "#06b6d4"][j % 6],
        size: 3 + Math.random() * 4,
      })),
    }))
  , []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {/* Confetti */}
      {confetti.map(p => (
        <div
          key={`c-${p.id}`}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: p.size,
            height: p.type === "rect" ? p.size * 1.5 : p.size,
            backgroundColor: p.color,
            borderRadius: p.type === "circle" ? "50%" : "2px",
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration}s ease-out ${p.delay}s forwards`,
            opacity: 0,
          }}
        />
      ))}
      {/* Fireworks */}
      {fireworks.map(fw => (
        <div
          key={`fw-${fw.id}`}
          className="absolute"
          style={{ left: `${fw.x}%`, top: `${fw.y}%` }}
        >
          {fw.sparks.map(s => (
            <div
              key={s.id}
              className="absolute rounded-full"
              style={{
                width: s.size,
                height: s.size,
                backgroundColor: s.color,
                animation: `firework-spark 1s ease-out ${fw.delay}s forwards`,
                '--spark-x': `${Math.cos(s.angle * Math.PI / 180) * s.distance}px`,
                '--spark-y': `${Math.sin(s.angle * Math.PI / 180) * s.distance}px`,
                opacity: 0,
              } as React.CSSProperties}
            />
          ))}
          {/* Flash */}
          <div
            className="absolute w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{
              backgroundColor: "white",
              animation: `firework-flash 0.5s ease-out ${fw.delay}s forwards`,
              opacity: 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
interface ChecklistProducaoDiaProps {
  targetDate?: string;
}

function parseLocalDate(dateStr?: string) {
  if (!dateStr) return new Date();

  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

import { useAuth } from "@/contexts/AuthContext";

export default function ChecklistProducaoDia({ targetDate }: ChecklistProducaoDiaProps) {
  const { factoryId } = useAuth();
  const dataBase = parseLocalDate(targetDate);
  const hojeStr = `${dataBase.getFullYear()}-${String(dataBase.getMonth() + 1).padStart(2, "0")}-${String(dataBase.getDate()).padStart(2, "0")}`;
  const CONCLUIDOS_KEY = `checklist-concluidos-${hojeStr}`;
  const REGISTRADOS_KEY = `checklist-registrados-${hojeStr}`;

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [registrados, setRegistrados] = useState<Set<string>>(new Set());
  const [receitaMap, setReceitaMap] = useState<Record<string, number>>({});

  function saveRegistrados(newSet: Set<string>) {
    setRegistrados(newSet);
    localStorage.setItem(REGISTRADOS_KEY, JSON.stringify([...newSet]));
  }

  useEffect(() => { fetchDecisoes(); loadReceitaMap(); }, [hojeStr, factoryId]);

  async function loadReceitaMap() {
    let rQ = (supabase as any).from("sabor_receita").select("sabor_id, gelos_por_lote");
    if (factoryId) rQ = rQ.eq("factory_id", factoryId);
    const { data } = await rQ;
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { if (!map[r.sabor_id]) map[r.sabor_id] = r.gelos_por_lote; });
    setReceitaMap(map);
  }

  // Load registered items from localStorage as initial fallback
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REGISTRADOS_KEY);
      if (saved) setRegistrados(new Set(JSON.parse(saved)));
    } catch {}
  }, [REGISTRADOS_KEY]);

  async function fetchDecisoes() {
    setLoading(true);
    try {
      const inicioHoje = `${hojeStr}T00:00:00-03:00`;
      const fimHoje = `${hojeStr}T23:59:59-03:00`;
      let dq = (supabase as any)
        .from("decisoes_producao").select("*")
        .gte("created_at", inicioHoje).lte("created_at", fimHoje)
        .gt("lotes_autorizados", 0).order("created_at", { ascending: true });
      if (factoryId) dq = dq.eq("factory_id", factoryId);
      const { data, error } = await dq;
      if (error) throw error;
      if (!data || data.length === 0) { setChecklist([]); setLoading(false); return; }

      // ── Carregar produções JÁ registradas hoje do banco (server-side dedup) ──
      let pq = (supabase as any)
        .from("producoes").select("sabor_id, observacoes")
        .gte("created_at", inicioHoje).lte("created_at", fimHoje)
        .like("observacoes", "%Checklist produção diária%");
      if (factoryId) pq = pq.eq("factory_id", factoryId);
      const { data: producoesHoje } = await pq;

      // Mapear produções existentes por sabor para contar lotes já registrados
      const lotesRegistradosDB: Record<string, number> = {};
      (producoesHoje || []).forEach((p: any) => {
        lotesRegistradosDB[p.sabor_id] = (lotesRegistradosDB[p.sabor_id] || 0) + 1;
      });

      let concluidos: Record<string, string> = {};
      try { const saved = localStorage.getItem(CONCLUIDOS_KEY); if (saved) concluidos = JSON.parse(saved); } catch {}

      const items: ChecklistItem[] = [];
      const dbRegistrados = new Set<string>();

      data.forEach((d: any) => {
        const jaRegistradosQtd = lotesRegistradosDB[d.sabor_id] || 0;
        for (let l = 1; l <= d.lotes_autorizados; l++) {
          const itemId = `${d.sabor_id}-${l}`;
          // Se o lote já existe no banco, marcar como registrado E concluído
          const jaRegistradoNoBanco = l <= jaRegistradosQtd;
          if (jaRegistradoNoBanco) {
            dbRegistrados.add(itemId);
            if (!concluidos[itemId]) {
              concluidos[itemId] = "DB";
            }
          }
          items.push({
            id: itemId, saborId: d.sabor_id, saborNome: d.sabor_nome,
            loteNumero: l, totalLotes: d.lotes_autorizados,
            concluido: !!concluidos[itemId] || jaRegistradoNoBanco,
            horaConclusao: concluidos[itemId] || (jaRegistradoNoBanco ? "✓" : undefined),
          });
        }
      });

      // Merge localStorage registrados com os do banco
      const mergedRegistrados = new Set([
        ...dbRegistrados,
        ...((() => { try { const s = localStorage.getItem(REGISTRADOS_KEY); return s ? JSON.parse(s) : []; } catch { return []; } })()),
      ]);
      saveRegistrados(mergedRegistrados);

      setChecklist(items);
      // Sync concluidos com o que veio do banco
      localStorage.setItem(CONCLUIDOS_KEY, JSON.stringify(concluidos));
    } catch (e) { console.error("Erro ao carregar checklist:", e); }
    finally { setLoading(false); }
  }

  function saveConcluidos(updated: ChecklistItem[]) {
    const concluidos: Record<string, string> = {};
    updated.forEach(item => { if (item.concluido && item.horaConclusao) concluidos[item.id] = item.horaConclusao; });
    localStorage.setItem(CONCLUIDOS_KEY, JSON.stringify(concluidos));
  }

  function triggerCelebration(updated: ChecklistItem[]) {
    const allDone = updated.every(c => c.concluido);
    if (allDone && updated.length > 0) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
    }
  }

  async function toggleItem(id: string) {
    const item = checklist.find(c => c.id === id);
    if (!item) return;

    const nowMarking = !item.concluido;

    const updated = checklist.map(c =>
      c.id === id ? { ...c, concluido: nowMarking, horaConclusao: nowMarking ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined } : c
    );
    saveConcluidos(updated);
    setChecklist(updated);
    triggerCelebration(updated);

    // Only register if marking AND not already registered
    if (nowMarking && !registrados.has(id)) {
      try {
        const savedFuncs = localStorage.getItem(`checklist-producao-${hojeStr}-funcs`);
        const operador = localStorage.getItem(`checklist-producao-${hojeStr}-operador`) || "sistema";
        const funcIds: string[] = savedFuncs ? JSON.parse(savedFuncs) : [];

        const gelosPorLote = receitaMap[item.saborId] || 84;
        await realizarProducao({
          p_sabor_id: item.saborId,
          p_modo: "lote",
          p_quantidade_lotes: 1,
          p_quantidade_total: gelosPorLote,
          p_operador: operador,
          p_observacoes: `Lote ${item.loteNumero}/${item.totalLotes} - Checklist produção diária`,
          p_funcionarios: funcIds.filter(f => f !== "patroes").map(f => ({ funcionario_id: f, quantidade_produzida: 0 })),
          p_ignorar_estoque: true,
        });

        const newRegistrados = new Set(registrados);
        newRegistrados.add(id);
        saveRegistrados(newRegistrados);

        toast({ title: `✅ Lote ${item.loteNumero} de ${item.saborNome} registrado!` });
      } catch (e: any) {
        console.error("Erro ao registrar produção:", e);
        toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
        // Revert
        setChecklist(prev => {
          const reverted = prev.map(c =>
            c.id === id ? { ...c, concluido: false, horaConclusao: undefined } : c
          );
          saveConcluidos(reverted);
          return reverted;
        });
      }
    }
  }

  async function toggleSabor(saborId: string) {
    const saborItens = checklist.filter(c => c.saborId === saborId);
    const allDone = saborItens.every(c => c.concluido);
    const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Only register production for items being newly marked AND not already registered
    const itensParaRegistrar = allDone ? [] : saborItens.filter(c => !c.concluido && !registrados.has(c.id));

    const updated = checklist.map(c =>
      c.saborId === saborId ? { ...c, concluido: !allDone, horaConclusao: !allDone ? now : undefined } : c
    );
    saveConcluidos(updated);
    setChecklist(updated);
    triggerCelebration(updated);

    if (itensParaRegistrar.length > 0) {
      try {
        const savedFuncs = localStorage.getItem(`checklist-producao-${hojeStr}-funcs`);
        const operador = localStorage.getItem(`checklist-producao-${hojeStr}-operador`) || "sistema";
        const funcIds: string[] = savedFuncs ? JSON.parse(savedFuncs) : [];

        for (const item of itensParaRegistrar) {
          await realizarProducao({
            p_sabor_id: item.saborId,
            p_modo: "lote",
            p_quantidade_lotes: 1,
            p_quantidade_total: 84,
            p_operador: operador,
            p_observacoes: `Lote ${item.loteNumero}/${item.totalLotes} - Checklist produção diária`,
            p_funcionarios: funcIds.filter(f => f !== "patroes").map(f => ({ funcionario_id: f, quantidade_produzida: 0 })),
            p_ignorar_estoque: true,
          });
        }

        const newRegistrados = new Set(registrados);
        itensParaRegistrar.forEach(item => newRegistrados.add(item.id));
        saveRegistrados(newRegistrados);

        toast({ title: `✅ ${itensParaRegistrar.length} lote(s) de ${saborItens[0]?.saborNome} registrados!` });
      } catch (e: any) {
        console.error("Erro ao registrar produção:", e);
        toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
      }
    }
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
  const total = checklist.length;
  const progressGeral = Math.round((totalConcluidos / total) * 100);
  const completo = totalConcluidos === total;

  return (
    <div className="mb-6 space-y-4">
      {/* ── Barra de progresso geral ── */}
      <Card className="relative overflow-hidden">
        {showCelebration && <Celebration />}
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <ProgressRing progress={progressGeral} color={completo ? "#22c55e" : "hsl(var(--primary))"} size={56} strokeWidth={5}>
              <span className="text-xs font-bold text-foreground">{progressGeral}%</span>
            </ProgressRing>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-foreground">Progresso do Dia</span>
                <Badge variant={completo ? "default" : "secondary"} className="text-xs font-bold" style={completo ? { backgroundColor: "#22c55e" } : {}}>
                  {totalConcluidos}/{total} lotes
                </Badge>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressGeral}%`, background: completo ? "#22c55e" : "hsl(var(--primary))" }}
                />
              </div>
              {/* Mini rings por sabor */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {saboresUnicos.map(saborId => {
                  const itens = checklist.filter(c => c.saborId === saborId);
                  const nome = itens[0]?.saborNome || "";
                  const color = getSaborColor(nome);
                  const done = itens.filter(c => c.concluido).length;
                  const pct = Math.round((done / itens.length) * 100);
                  return (
                    <div key={saborId} className="flex items-center gap-1.5">
                      <ProgressRing progress={pct} color={color} size={28} strokeWidth={3}>
                        <span className="text-[7px] font-bold text-foreground">{done}</span>
                      </ProgressRing>
                      <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[60px]">{nome}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Celebration banner */}
          {completo && (
            <div className={`mt-4 flex items-center justify-center gap-2 py-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 ${showCelebration ? "animate-scale-in" : "animate-fade-in"}`}>
              <PartyPopper className="h-5 w-5 text-green-600" />
              <span className="text-sm font-bold text-green-600">Produção do dia concluída! 🎉</span>
              <PartyPopper className="h-5 w-5 text-green-600" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cards por sabor ── */}
      {saboresUnicos.map(saborId => {
        const itens = checklist.filter(c => c.saborId === saborId);
        const nome = itens[0]?.saborNome || "";
        const color = getSaborColor(nome);
        const saborConcluidos = itens.filter(c => c.concluido).length;
        const todosOk = saborConcluidos === itens.length;
        const saborPct = Math.round((saborConcluidos / itens.length) * 100);

        return (
          <div
            key={saborId}
            className={`rounded-xl border bg-card overflow-hidden shadow-sm transition-all duration-300 ${todosOk ? "opacity-75" : ""}`}
            style={{ borderLeftWidth: 4, borderLeftColor: color }}
          >
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleSabor(saborId)}>
              <div className="flex items-center gap-3">
                <ProgressRing progress={saborPct} color={color} size={36} strokeWidth={3.5}>
                  {todosOk ? (
                    <svg width={16} height={16} viewBox="0 0 16 16"><polyline points="3,8 6.5,11.5 13,4.5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <span className="text-[8px] font-bold text-foreground">{saborPct}%</span>
                  )}
                </ProgressRing>
                <span className={`font-semibold text-sm ${todosOk ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {nome}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs font-bold" style={todosOk ? { backgroundColor: `${color}20`, color } : {}}>
                {saborConcluidos}/{itens.length} lotes
              </Badge>
            </div>

            <div className="px-4 pb-3 space-y-1.5">
              {itens.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                    item.concluido ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/40 hover:bg-muted/60"
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
