import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Factory, TrendingUp, TrendingDown, Minus, RefreshCw,
  AlertTriangle, CheckCircle2, Snowflake, BarChart3, Check, X,
  Brain, Sparkles, ClipboardList, PartyPopper, History, ChevronDown, ChevronUp, CalendarDays
} from "lucide-react";

interface ChecklistItem {
  id: string;
  saborId: string;
  saborNome: string;
  loteNumero: number;
  totalLotes: number;
  concluido: boolean;
  horaConclusao?: string;
}

interface SaborAnalise {
  id: string;
  nome: string;
  estoqueAtual: number;
  vendas7d: number;
  vendas30d: number;
  mediaDiaria: number;
  tendencia: "alta" | "baixa" | "estavel";
  diasCobertura: number;
  loteSugerido: number;
  selecionado: boolean;
  lotesCustom: number;
  prioritario: boolean;
  ordemPrioridade: number;
  // Learning fields
  loteAprendido: number | null; // suggestion based on past behavior
  confianca: number; // 0-100, confidence in the learned value
  historicoAjustes: number; // how many times user adjusted this flavor
}

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

function ProgressRing({ progress, color, size = 52 }: { progress: number; color: string; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out" />
    </svg>
  );
}

// Escala fixa
const ESCALA_PRODUCAO: Record<number, string[]> = {
  2: ["aghata", "maria"],
  3: ["aghata", "maria"],
  4: ["jhulia", "aghata"],
  5: ["jhulia", "aghata"],
};
const NOMES_DIA: Record<number, string> = {
  0: "Domingo", 1: "Segunda-feira", 2: "Terça-feira",
  3: "Quarta-feira", 4: "Quinta-feira", 5: "Sexta-feira", 6: "Sábado",
};

// Learning engine: analyze past decisions to predict preferred lots
function calcularAprendizado(
  decisoes: any[],
  saborId: string,
  diaSemana: number,
  loteSugeridoAtual: number
): { loteAprendido: number | null; confianca: number; historicoAjustes: number } {
  // Filter decisions for this flavor, weighted towards same day of week
  const todasDoSabor = decisoes.filter((d: any) => d.sabor_id === saborId);
  const doMesmoDia = todasDoSabor.filter((d: any) => d.dia_semana === diaSemana);

  if (todasDoSabor.length < 2) {
    return { loteAprendido: null, confianca: 0, historicoAjustes: 0 };
  }

  // Weighted average: same-day decisions weight 3x, others 1x
  let somaLotes = 0;
  let somaPeso = 0;
  const agora = Date.now();

  todasDoSabor.forEach((d: any) => {
    const idade = (agora - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const pesoRecencia = Math.max(0.2, 1 - idade / 60); // decay over 60 days
    const pesoDia = d.dia_semana === diaSemana ? 3 : 1;
    const peso = pesoRecencia * pesoDia;
    somaLotes += d.lotes_autorizados * peso;
    somaPeso += peso;
  });

  const mediaAprendida = Math.round(somaLotes / somaPeso);
  
  // Confidence: based on quantity of data + consistency
  const lotesAutorizados = todasDoSabor.map((d: any) => d.lotes_autorizados);
  const desvio = Math.sqrt(
    lotesAutorizados.reduce((s: number, l: number) => s + Math.pow(l - mediaAprendida, 2), 0) / lotesAutorizados.length
  );
  const consistencia = Math.max(0, 100 - desvio * 30);
  const volumeData = Math.min(100, todasDoSabor.length * 10);
  const confianca = Math.round((consistencia * 0.6 + volumeData * 0.4));

  const ajustes = todasDoSabor.filter((d: any) => d.ajuste !== 0).length;

  return {
    loteAprendido: mediaAprendida,
    confianca: Math.min(100, confianca),
    historicoAjustes: ajustes,
  };
}

export default function PlanoProducaoDiario() {
  const [analises, setAnalises] = useState<SaborAnalise[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [funcSelecionados, setFuncSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [executado, setExecutado] = useState(false);
  const [modoIA, setModoIA] = useState(false);
  const [totalDecisoes, setTotalDecisoes] = useState(0);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [modoChecklist, setModoChecklist] = useState(false);
  const [historicoDecisoes, setHistoricoDecisoes] = useState<any[]>([]);
  const [historicoExpanded, setHistoricoExpanded] = useState(false);

  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const diaProducao = diaSemana >= 2 && diaSemana <= 5;
  const escalaDoDia = ESCALA_PRODUCAO[diaSemana] || [];

  const hojeStr = hoje.toISOString().slice(0, 10);
  const CHECKLIST_KEY = `checklist-producao-${hojeStr}`;

  // Recover checklist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(CHECKLIST_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChecklist(parsed);
        setModoChecklist(true);
        setExecutado(true);
      } catch {}
    }
    calcular();
    fetchHistorico();
  }, []);

  async function fetchHistorico() {
    try {
      const { data, error } = await (supabase as any)
        .from("decisoes_producao")
        .select("*")
        .gt("lotes_autorizados", 0)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      // Agrupar por dia
      const porDia: Record<string, any[]> = {};
      (data || []).forEach((d: any) => {
        const dia = new Date(d.created_at).toLocaleDateString("pt-BR");
        if (!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(d);
      });

      const resultado = Object.entries(porDia).map(([dia, itens]) => ({
        dia,
        itens,
        totalLotes: itens.reduce((s: number, i: any) => s + i.lotes_autorizados, 0),
        totalUnidades: itens.reduce((s: number, i: any) => s + i.lotes_autorizados * 84, 0),
        operador: itens[0]?.operador || "sistema",
      }));

      setHistoricoDecisoes(resultado);
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    }
  }

  async function calcular() {
    setLoading(true);
    setExecutado(false);
    try {
      const [vendasRes, gelosRes, saboresRes, funcsRes, decisoesRes] = await Promise.all([
        (supabase as any).from("venda_itens").select("sabor_id, quantidade, vendas!inner(created_at, status)"),
        (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome, id)"),
        (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome"),
        (supabase as any).from("funcionarios").select("id, nome").eq("ativo", true).order("nome"),
        (supabase as any).from("decisoes_producao").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      const funcs = funcsRes.data || [];
      setFuncionarios(funcs);

      if (escalaDoDia.length > 0) {
        const ids = escalaDoDia
          .map(nome => funcs.find((f: any) => f.nome.toLowerCase().includes(nome)))
          .filter(Boolean)
          .map((f: any) => f.id);
        if (ids.length > 0) setFuncSelecionados(ids);
      }

      const decisoes = decisoesRes.data || [];
      // Count unique daily sessions (not individual sabor rows)
      const diasUnicos = new Set(
        decisoes.map((d: any) => new Date(d.created_at).toISOString().slice(0, 10))
      );
      setTotalDecisoes(diasUnicos.size);
      
      // Auto-enable AI mode when enough data (10 daily sessions)
      if (diasUnicos.size >= 10) setModoIA(true);

      const vendaItens = (vendasRes.data || []).filter((v: any) => v.vendas?.status !== "cancelada");
      const gelos = gelosRes.data || [];
      const saboresAtivos = saboresRes.data || [];

      const agora = new Date();
      const seteDias = new Date(agora); seteDias.setDate(seteDias.getDate() - 7);
      const trintaDias = new Date(agora); trintaDias.setDate(trintaDias.getDate() - 30);

      const vendaMap: Record<string, { v7d: number; v30d: number }> = {};
      vendaItens.forEach((item: any) => {
        const id = item.sabor_id;
        if (!vendaMap[id]) vendaMap[id] = { v7d: 0, v30d: 0 };
        const dt = new Date(item.vendas?.created_at);
        if (dt >= seteDias) vendaMap[id].v7d += item.quantidade;
        if (dt >= trintaDias) vendaMap[id].v30d += item.quantidade;
      });

      const prioridadeDiaria = ["melancia", "maçã verde", "morango", "maracujá", "água de coco"];

      const result: SaborAnalise[] = saboresAtivos.map((sabor: any) => {
        const gelo = gelos.find((g: any) => g.sabor_id === sabor.id);
        const estoqueAtual = gelo?.quantidade || 0;
        const v = vendaMap[sabor.id] || { v7d: 0, v30d: 0 };
        const mediaDiaria7d = v.v7d / 7;
        const mediaDiaria30d = v.v30d / 30;

        let tendencia: "alta" | "baixa" | "estavel" = "estavel";
        if (mediaDiaria7d > mediaDiaria30d * 1.2) tendencia = "alta";
        else if (mediaDiaria7d < mediaDiaria30d * 0.8) tendencia = "baixa";

        const diasCobertura = mediaDiaria7d > 0 ? Math.floor(estoqueAtual / mediaDiaria7d) : 999;
        const necessario7d = Math.ceil(mediaDiaria7d * 7);
        const deficit = Math.max(0, necessario7d - estoqueAtual);
        const loteSugerido = Math.ceil(deficit / 84);

        const idx = prioridadeDiaria.findIndex(p => sabor.nome.toLowerCase().includes(p));
        const prioritario = idx !== -1;

        // Learning engine
        const aprendizado = calcularAprendizado(decisoes, sabor.id, diaSemana, loteSugerido);

        // If AI mode is on and we have enough confidence, use learned value
        const usarAprendido = modoIA && aprendizado.loteAprendido !== null && aprendizado.confianca >= 50;
        const loteFinal = usarAprendido
          ? aprendizado.loteAprendido!
          : prioritario
            ? Math.max(1, loteSugerido || 1)
            : loteSugerido;

        return {
          id: sabor.id,
          nome: sabor.nome,
          estoqueAtual,
          vendas7d: v.v7d,
          vendas30d: v.v30d,
          mediaDiaria: Math.round(mediaDiaria7d * 10) / 10,
          tendencia,
          diasCobertura: Math.min(diasCobertura, 99),
          loteSugerido,
          selecionado: usarAprendido ? loteFinal > 0 : (prioritario ? true : loteSugerido > 0),
          lotesCustom: loteFinal,
          prioritario,
          ordemPrioridade: prioritario ? idx : 999,
          loteAprendido: aprendizado.loteAprendido,
          confianca: aprendizado.confianca,
          historicoAjustes: aprendizado.historicoAjustes,
        };
      });

      result.sort((a, b) => {
        if (a.prioritario && !b.prioritario) return -1;
        if (!a.prioritario && b.prioritario) return 1;
        if (a.prioritario && b.prioritario) return a.ordemPrioridade - b.ordemPrioridade;
        if (a.loteSugerido > 0 && b.loteSugerido === 0) return -1;
        if (a.loteSugerido === 0 && b.loteSugerido > 0) return 1;
        return a.diasCobertura - b.diasCobertura;
      });

      setAnalises(result);
    } catch (e) {
      console.error("Erro ao calcular plano:", e);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleSabor(id: string) {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, selecionado: !a.selecionado } : a));
  }

  function setLotes(id: string, lotes: number) {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, lotesCustom: Math.max(0, lotes) } : a));
  }

  function addFunc() { setFuncSelecionados(prev => [...prev, ""]); }
  function removeFunc(i: number) { setFuncSelecionados(prev => prev.filter((_, idx) => idx !== i)); }
  function updateFunc(i: number, val: string) {
    setFuncSelecionados(prev => { const list = [...prev]; list[i] = val; return list; });
  }

  // Log decisions for learning
  async function registrarDecisoes(itens: SaborAnalise[]) {
    const validFuncs = funcSelecionados.filter(f => f !== "");
    const operador = validFuncs
      .map(f => funcionarios.find(fn => fn.id === f)?.nome)
      .filter(Boolean)
      .join(", ") || "sistema";

    const rows = itens.map(item => ({
      dia_semana: diaSemana,
      sabor_id: item.id,
      sabor_nome: item.nome,
      estoque_no_momento: item.estoqueAtual,
      vendas_7d: item.vendas7d,
      media_diaria: item.mediaDiaria,
      dias_cobertura: item.diasCobertura,
      lotes_sugeridos: item.loteSugerido,
      lotes_autorizados: item.lotesCustom,
      operador,
    }));

    await (supabase as any).from("decisoes_producao").insert(rows);
  }

  async function autorizarProducao() {
    const itens = analises.filter(a => a.selecionado && a.lotesCustom > 0);
    if (itens.length === 0) return toast({ title: "Selecione ao menos um sabor", variant: "destructive" });

    const validFuncs = funcSelecionados.filter(f => f !== "");
    if (validFuncs.length === 0) return toast({ title: "Selecione ao menos um responsável", variant: "destructive" });

    const nomesFuncionarios = validFuncs
      .map(f => funcionarios.find(fn => fn.id === f)?.nome)
      .filter(Boolean)
      .join(", ");

    setExecutando(true);
    try {
      // Log decisions for learning BEFORE production
      await registrarDecisoes(itens);

      for (const item of itens) {
        await realizarProducao({
          p_sabor_id: item.id,
          p_modo: "lote",
          p_quantidade_lotes: item.lotesCustom,
          p_quantidade_total: item.lotesCustom * 84,
          p_operador: nomesFuncionarios || "sistema",
          p_observacoes: `Produção autorizada conforme estratégia de reposição por giro de vendas.`,
          p_funcionarios: validFuncs.map(f => ({ funcionario_id: f, quantidade_produzida: 0 })),
          p_ignorar_estoque: true,
        });
      }

      const totalLotes = itens.reduce((s, i) => s + i.lotesCustom, 0);
      const totalUnidades = totalLotes * 84;
      toast({
        title: "✅ Produção autorizada!",
        description: `${itens.length} sabor(es) · ${totalLotes} lote(s) · ${totalUnidades.toLocaleString()} un`,
      });

      // Generate production checklist
      const checklistItems: ChecklistItem[] = [];
      itens.forEach(item => {
        for (let l = 1; l <= item.lotesCustom; l++) {
          checklistItems.push({
            id: `${item.id}-${l}`,
            saborId: item.id,
            saborNome: item.nome,
            loteNumero: l,
            totalLotes: item.lotesCustom,
            concluido: false,
          });
        }
      });
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklistItems));
      setChecklist(checklistItems);
      setModoChecklist(true);
      setExecutado(true);
    } catch (e: any) {
      toast({ title: "Erro na produção", description: e.message, variant: "destructive" });
    } finally {
      setExecutando(false);
    }
  }

  function toggleCheckItem(id: string) {
    setChecklist(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, concluido: !c.concluido, horaConclusao: !c.concluido ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined } : c
      );
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  const checklistConcluidos = checklist.filter(c => c.concluido).length;
  const checklistTotal = checklist.length;
  const checklistProgress = checklistTotal > 0 ? Math.round((checklistConcluidos / checklistTotal) * 100) : 0;
  const checklistCompleto = checklistTotal > 0 && checklistConcluidos === checklistTotal;

  const selecionados = analises.filter(a => a.selecionado && a.lotesCustom > 0);
  const totalLotes = selecionados.reduce((s, a) => s + a.lotesCustom, 0);
  const totalUnidades = totalLotes * 84;
  const progressTotal = analises.length > 0 ? Math.round((selecionados.length / analises.length) * 100) : 0;
  const confiancaMedia = analises.length > 0 
    ? Math.round(analises.reduce((s, a) => s + a.confianca, 0) / analises.length) 
    : 0;

  const tendenciaIcon = (t: string) => {
    if (t === "alta") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (t === "baixa") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  // If checklist mode is active, show production checklist
  if (modoChecklist) {
    // Group checklist by sabor
    const saboresUnicos = [...new Set(checklist.map(c => c.saborId))];

    return (
      <div className="space-y-5 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ProgressRing progress={checklistProgress} color={checklistCompleto ? "#22c55e" : "hsl(var(--primary))"} size={56} />
              <div className="absolute inset-0 flex items-center justify-center">
                {checklistCompleto ? (
                  <PartyPopper className="h-5 w-5 text-green-500" />
                ) : (
                  <ClipboardList className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">Produção em Andamento</h1>
              <p className="text-xs text-muted-foreground">
                {checklistConcluidos} de {checklistTotal} lotes concluídos · {checklistProgress}%
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setModoChecklist(false); calcular(); }}>
            <X className="h-4 w-4 mr-1" />
            Voltar ao Plano
          </Button>
        </div>

        {/* Progress bar geral */}
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${checklistProgress}%`,
              background: checklistCompleto
                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
            }}
          />
        </div>

        {/* Comanda completa */}
        {checklistCompleto && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="py-6 text-center">
              <PartyPopper className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-lg">Produção do dia concluída! 🎉</p>
              <p className="text-xs text-muted-foreground mt-1">
                Todos os {checklistTotal} lotes foram produzidos com sucesso.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Checklist por sabor */}
        <div className="space-y-3">
          {saboresUnicos.map(saborId => {
            const itensDoSabor = checklist.filter(c => c.saborId === saborId);
            const concluidos = itensDoSabor.filter(c => c.concluido).length;
            const todosOk = concluidos === itensDoSabor.length;
            const saborNome = itensDoSabor[0]?.saborNome || "";
            const color = getSaborColor(saborNome);
            const progressSabor = Math.round((concluidos / itensDoSabor.length) * 100);

            return (
              <Card
                key={saborId}
                className={`transition-all duration-300 overflow-hidden ${todosOk ? "opacity-70" : ""}`}
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <CardContent className="py-3 px-4">
                  {/* Sabor header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {todosOk ? (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#22c55e" }}>
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="relative">
                          <ProgressRing progress={progressSabor} color={color} size={28} />
                        </div>
                      )}
                      <span className={`font-bold text-sm ${todosOk ? "line-through text-muted-foreground" : ""}`}>
                        {saborNome}
                      </span>
                    </div>
                    <Badge variant={todosOk ? "default" : "secondary"} className="text-[10px]" style={todosOk ? { backgroundColor: "#22c55e" } : {}}>
                      {concluidos}/{itensDoSabor.length} lotes
                    </Badge>
                  </div>

                  {/* Lotes individuais */}
                  <div className="space-y-1">
                    {itensDoSabor.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-all duration-200 ${
                          item.concluido
                            ? "bg-green-500/10 border border-green-500/20"
                            : "bg-muted/50 border border-transparent hover:border-primary/20 hover:bg-muted"
                        }`}
                        onClick={() => toggleCheckItem(item.id)}
                      >
                        {/* Check */}
                        <div
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                            item.concluido
                              ? "border-green-500 bg-green-500 scale-110"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {item.concluido && <Check className="h-4 w-4 text-white" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <span className={`text-sm font-semibold ${item.concluido ? "line-through text-muted-foreground" : ""}`}>
                            Lote {item.loteNumero}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">84 unidades</span>
                        </div>

                        {/* Hora conclusão */}
                        {item.concluido && item.horaConclusao && (
                          <span className="text-[10px] text-green-600 font-medium">
                            ✓ {item.horaConclusao}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ProgressRing progress={progressTotal} color="hsl(var(--primary))" size={56} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Factory className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold">Plano de Produção</h1>
            <p className="text-xs text-muted-foreground">
              {NOMES_DIA[diaSemana]} · {selecionados.length} de {analises.length} sabores · {totalLotes} lotes · {totalUnidades.toLocaleString()} un
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={calcular} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </div>

      {/* Painel de Estoque Atual - visão rápida antes de decidir */}
      {analises.length > 0 && (
        <Card>
          <CardContent className="pt-3 pb-2 px-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Snowflake className="h-3 w-3" /> Estoque Atual de Gelos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...analises]
                .sort((a, b) => b.estoqueAtual - a.estoqueAtual)
                .map(a => {
                  const color = getSaborColor(a.nome);
                  const critico = a.diasCobertura <= 3 && a.diasCobertura !== 999;
                  const alerta = a.diasCobertura > 3 && a.diasCobertura <= 7;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: critico ? "hsl(var(--destructive) / 0.1)" : alerta ? "rgba(245,158,11,0.1)" : `${color}15`,
                        border: `1px solid ${critico ? "hsl(var(--destructive) / 0.3)" : alerta ? "rgba(245,158,11,0.3)" : `${color}30`}`,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium truncate max-w-[80px]">{a.nome}</span>
                      <span className={`font-black ${critico ? "text-destructive" : alerta ? "text-amber-600" : ""}`}>
                        {a.estoqueAtual.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] bg-muted border border-border">
                <span className="font-medium">TOTAL</span>
                <span className="font-black">
                  {analises.reduce((s, a) => s + a.estoqueAtual, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learning status card */}
      <Card className={`border-dashed ${totalDecisoes >= 10 ? "border-primary/40 bg-primary/5" : "border-muted"}`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className={`h-4 w-4 ${totalDecisoes >= 10 ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-xs font-semibold">
                  {totalDecisoes < 5
                    ? "🧠 Aprendendo... (fase inicial)"
                    : totalDecisoes < 10
                      ? "🧠 Coletando padrões..."
                      : totalDecisoes < 20
                        ? "🧠 Sugestões baseadas no seu comportamento"
                        : "🤖 Modo inteligente ativo — sugestões automatizadas"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {totalDecisoes} decisões registradas · Confiança média: {confiancaMedia}%
                </p>
              </div>
            </div>
            {totalDecisoes >= 10 && (
              <Button
                variant={modoIA ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setModoIA(!modoIA)}
              >
                <Sparkles className="h-3 w-3" />
                {modoIA ? "IA Ativa" : "Ativar IA"}
              </Button>
            )}
          </div>
          {totalDecisoes < 10 && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, totalDecisoes * 10)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {10 - totalDecisoes} decisões restantes para ativar sugestões inteligentes
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso dia sem produção */}
      {!diaProducao && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-sm">Hoje é {NOMES_DIA[diaSemana]}</p>
            <p className="text-xs text-muted-foreground mt-1">
              A produção opera de <strong>Terça a Sexta-feira</strong>. Você ainda pode planejar para o próximo dia útil.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Escala do dia */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Escala — {NOMES_DIA[diaSemana]}
            </p>
            {diaProducao && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                {escalaDoDia.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(" + ")}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {funcSelecionados.map((fId, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Select value={fId} onValueChange={(v) => updateFunc(i, v)}>
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue placeholder="Funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {funcionarios.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {funcSelecionados.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeFunc(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={addFunc}>+ Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Checklist de sabores */}
      <div className="space-y-2">
        {analises.map((a) => {
          const color = getSaborColor(a.nome);
          const isSelected = a.selecionado && a.lotesCustom > 0;
          const coberturaPercent = Math.min(100, (a.diasCobertura / 14) * 100);
          const hasLearning = a.loteAprendido !== null && a.confianca >= 30;

          return (
            <Card
              key={a.id}
              className={`transition-all duration-300 cursor-pointer overflow-hidden ${
                isSelected ? "ring-1 ring-primary/30 shadow-md" : "hover:shadow-sm"
              }`}
              style={{
                borderLeft: `4px solid ${color}`,
                background: isSelected
                  ? `linear-gradient(135deg, ${color}08 0%, transparent 50%)`
                  : undefined,
              }}
              onClick={() => toggleSabor(a.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Check circle */}
                  <div
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isSelected ? "scale-110" : "bg-muted"
                    }`}
                    style={isSelected ? { backgroundColor: color, boxShadow: `0 0 12px ${color}40` } : {}}
                  >
                    {isSelected ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    )}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isSelected ? "" : "text-muted-foreground"}`}>
                        {a.prioritario && (
                          <span className="text-xs font-black mr-1" style={{ color }}>#{a.ordemPrioridade + 1}</span>
                        )}
                        {a.nome}
                      </span>
                      {a.prioritario && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary">
                          PRIORIDADE
                        </Badge>
                      )}
                      {hasLearning && modoIA && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-violet-400/50 text-violet-600">
                          <Brain className="h-2.5 w-2.5" />
                          {a.confianca}%
                        </Badge>
                      )}
                      <div className="flex items-center gap-0.5 ml-auto">
                        {tendenciaIcon(a.tendencia)}
                      </div>
                    </div>

                    {/* Barra de cobertura + métricas */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 max-w-[120px]">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${coberturaPercent}%`,
                              backgroundColor: a.diasCobertura <= 3 ? "hsl(var(--destructive))" : a.diasCobertura <= 7 ? "#f59e0b" : color,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                        <span>
                          <strong className={a.diasCobertura <= 3 ? "text-destructive" : a.diasCobertura <= 7 ? "text-amber-500" : "text-foreground"}>
                            {a.diasCobertura === 99 ? "∞" : `${a.diasCobertura}d`}
                          </strong> cobertura
                        </span>
                        <span>{a.estoqueAtual} un</span>
                        <span className="flex items-center gap-0.5">
                          <BarChart3 className="h-2.5 w-2.5" /> {a.mediaDiaria}/dia
                        </span>
                      </div>
                    </div>

                    {/* Learning insight */}
                    {hasLearning && modoIA && a.loteAprendido !== a.loteSugerido && (
                      <div className="flex items-center gap-1 text-[10px] text-violet-600 mt-1">
                        <Sparkles className="h-3 w-3" />
                        Você costuma produzir {a.loteAprendido} lote(s) deste sabor
                        {a.historicoAjustes > 0 && ` (ajustou ${a.historicoAjustes}x)`}
                      </div>
                    )}

                    {/* Alerta */}
                    {a.diasCobertura <= 3 && a.diasCobertura !== 999 && (
                      <div className="flex items-center gap-1 text-[10px] text-destructive mt-1">
                        <AlertTriangle className="h-3 w-3" /> Estoque crítico — risco de ruptura
                      </div>
                    )}
                  </div>

                  {/* Lote counter */}
                  {isSelected && (
                    <div className="shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full text-lg font-bold"
                        onClick={() => setLotes(a.id, a.lotesCustom - 1)}
                      >−</Button>
                      <div className="text-center w-14">
                        <span className="text-2xl font-black" style={{ color }}>{a.lotesCustom}</span>
                        <p className="text-[9px] text-muted-foreground leading-none -mt-0.5">
                          {a.lotesCustom * 84} un
                        </p>
                      </div>
                      <Button
                        variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full text-lg font-bold"
                        onClick={() => setLotes(a.id, a.lotesCustom + 1)}
                      >+</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Histórico de Planos */}
      {historicoDecisoes.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setHistoricoExpanded(!historicoExpanded)}
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">Histórico de Planos</span>
                <Badge variant="secondary" className="text-[10px]">
                  {historicoDecisoes.length} dia(s)
                </Badge>
              </div>
              {historicoExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </div>

            {historicoExpanded && (
              <div className="mt-3 space-y-3">
                {historicoDecisoes.map((registro, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-bold">{registro.dia}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{registro.totalLotes} lotes</span>
                        <span>·</span>
                        <span>{registro.totalUnidades.toLocaleString()} un</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Operador: {registro.operador}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {registro.itens.map((item: any) => {
                        const color = getSaborColor(item.sabor_nome);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: `${color}15`,
                              border: `1px solid ${color}30`,
                            }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-medium">{item.sabor_nome}</span>
                            <span className="font-black">{item.lotes_autorizados}L</span>
                            <span className="text-muted-foreground">({item.lotes_autorizados * 84}un)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {analises.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sem dados suficientes para gerar o plano de produção.
          </CardContent>
        </Card>
      )}

      {/* Sticky bottom bar */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/80 backdrop-blur-lg border-t">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ProgressRing progress={progressTotal} color="hsl(var(--primary))" size={44} />
                <div className="absolute inset-0 flex items-center justify-center">
                  {modoIA ? <Brain className="h-4 w-4 text-primary" /> : <Snowflake className="h-4 w-4 text-primary" />}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold">
                  {selecionados.length} sabor(es)
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalLotes} lotes · {totalUnidades.toLocaleString()} un
                  {modoIA && " · 🧠 IA"}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={autorizarProducao}
              disabled={executando || executado}
              className="gap-2 rounded-full px-6 shadow-lg"
              style={!executado && !executando ? {
                background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))`,
              } : {}}
            >
              {executando ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Produzindo...</>
              ) : executado ? (
                <><CheckCircle2 className="h-4 w-4" /> Registrada ✓</>
              ) : (
                <><Factory className="h-4 w-4" /> Autorizar</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
