import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Factory, TrendingUp, TrendingDown, Minus, RefreshCw,
  AlertTriangle, CheckCircle2, Snowflake, BarChart3, Check, X,
  Brain, Sparkles, History, ChevronDown, ChevronUp, CalendarDays,
  Trash2, Pencil, Zap, Target, Activity
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToastAction } from "@/components/ui/toast";


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
  loteAprendido: number | null;
  confianca: number; // 0-100
  historicoAjustes: number;
  nivelConfianca: "alta" | "media" | "baixa" | "insuficiente";
  // Feedback fields
  feedbackScore: number | null; // -100 to 100, negative = overproduction, positive = underproduction
  feedbackLabel: string;
  // AI suggestion fields
  aiLotes: number | null;
  aiConfianca: string | null;
  aiJustificativa: string | null;
  aiFeedbackNota: string | null;
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

// Escala fixa - APENAS para a fábrica "A Era dos Sabores"
const ERA_DOS_SABORES_ID = "00000000-0000-0000-0000-000000000001";
const ESCALA_ERA_DOS_SABORES: Record<number, string[]> = {
  0: [], 1: [], 2: ["aghata", "maria"],
  3: ["aghata", "maria"], 4: ["jhulia", "aghata"],
  5: ["jhulia", "aghata"], 6: [],
};
const NOMES_DIA: Record<number, string> = {
  0: "Domingo", 1: "Segunda-feira", 2: "Terça-feira",
  3: "Quarta-feira", 4: "Quinta-feira", 5: "Sexta-feira", 6: "Sábado",
};

const ACTIVATION_THRESHOLD = 25; // Increased from 10 to 25 for better accuracy
const HIGH_CONFIDENCE_THRESHOLD = 85; // Only auto-fill at 85%+

// Learning engine with graduated confidence
function calcularAprendizado(
  decisoes: any[],
  saborId: string,
  diaSemana: number,
  loteSugeridoAtual: number
): { loteAprendido: number | null; confianca: number; historicoAjustes: number; nivelConfianca: "alta" | "media" | "baixa" | "insuficiente" } {
  const todasDoSabor = decisoes.filter((d: any) => d.sabor_id === saborId);
  const doMesmoDia = todasDoSabor.filter((d: any) => d.dia_semana === diaSemana);

  if (todasDoSabor.length < 3) {
    return { loteAprendido: null, confianca: 0, historicoAjustes: 0, nivelConfianca: "insuficiente" };
  }

  let somaLotes = 0;
  let somaPeso = 0;
  const agora = Date.now();

  todasDoSabor.forEach((d: any) => {
    const idade = (agora - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const pesoRecencia = Math.max(0.1, 1 - idade / 90); // decay over 90 days (increased from 60)
    const pesoDia = d.dia_semana === diaSemana ? 3 : 1;
    const peso = pesoRecencia * pesoDia;
    somaLotes += d.lotes_autorizados * peso;
    somaPeso += peso;
  });

  const mediaAprendida = Math.round(somaLotes / somaPeso);
  
  const lotesAutorizados = todasDoSabor.map((d: any) => d.lotes_autorizados);
  const desvio = Math.sqrt(
    lotesAutorizados.reduce((s: number, l: number) => s + Math.pow(l - mediaAprendida, 2), 0) / lotesAutorizados.length
  );
  const consistencia = Math.max(0, 100 - desvio * 25);
  const volumeData = Math.min(100, todasDoSabor.length * 4); // Need more data (was *10, now *4)
  const bonusMesmoDia = Math.min(20, doMesmoDia.length * 5); // Bonus for same-day data
  const confianca = Math.round(Math.min(100, consistencia * 0.5 + volumeData * 0.3 + bonusMesmoDia));

  const ajustes = todasDoSabor.filter((d: any) => d.ajuste !== 0).length;

  // Graduated confidence levels
  let nivelConfianca: "alta" | "media" | "baixa" | "insuficiente";
  if (confianca >= HIGH_CONFIDENCE_THRESHOLD) nivelConfianca = "alta";
  else if (confianca >= 50) nivelConfianca = "media";
  else if (confianca >= 20) nivelConfianca = "baixa";
  else nivelConfianca = "insuficiente";

  return {
    loteAprendido: mediaAprendida,
    confianca,
    historicoAjustes: ajustes,
    nivelConfianca,
  };
}

// Feedback loop: compare planned vs actual production and sales
function calcularFeedback(
  decisoes: any[],
  producoes: any[],
  vendaItens: any[],
  saborId: string
): { feedbackScore: number; feedbackLabel: string } {
  // Last 30 days
  const trintaDias = new Date();
  trintaDias.setDate(trintaDias.getDate() - 30);

  const decisoesRecentes = decisoes.filter((d: any) => 
    d.sabor_id === saborId && new Date(d.created_at) >= trintaDias
  );
  const planejado = decisoesRecentes.reduce((s: number, d: any) => s + d.lotes_autorizados * 84, 0);
  
  const produzido = producoes
    .filter((p: any) => p.sabor_id === saborId && new Date(p.created_at) >= trintaDias)
    .reduce((s: number, p: any) => s + p.quantidade_total, 0);
  
  const vendido = vendaItens
    .filter((v: any) => v.sabor_id === saborId)
    .reduce((s: number, v: any) => s + v.quantidade, 0);

  if (produzido === 0 && vendido === 0) {
    return { feedbackScore: 0, feedbackLabel: "Sem dados" };
  }

  // Score: positive = selling well relative to production, negative = overproducing
  const ratio = produzido > 0 ? vendido / produzido : 0;
  let score: number;
  let label: string;

  if (ratio >= 0.8 && ratio <= 1.1) {
    score = 90;
    label = "✅ Equilibrado";
  } else if (ratio > 1.1) {
    score = Math.min(100, Math.round(ratio * 50));
    label = "📈 Demanda alta — aumentar";
  } else if (ratio >= 0.5) {
    score = Math.round(ratio * 80);
    label = "⚠️ Leve excesso";
  } else {
    score = Math.round(ratio * 50);
    label = "🔴 Excesso de produção";
  }

  return { feedbackScore: score, feedbackLabel: label };
}


export default function PlanoProducaoDiario() {
  const { factoryId } = useAuth();
  const navigate = useNavigate();
  const [analises, setAnalises] = useState<SaborAnalise[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [funcSelecionados, setFuncSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [executado, setExecutado] = useState(false);
  const [planoHojeJaFeito, setPlanoHojeJaFeito] = useState(false);
  const [modoIA, setModoIA] = useState(false);
  const [totalDecisoes, setTotalDecisoes] = useState(0);
  const [historicoDecisoes, setHistoricoDecisoes] = useState<any[]>([]);
  const [historicoExpanded, setHistoricoExpanded] = useState(false);
  const [deleteRegistro, setDeleteRegistro] = useState<any>(null);
  const [editRegistro, setEditRegistro] = useState<any>(null);
  const [editItens, setEditItens] = useState<{ id: string; sabor_nome: string; lotes_autorizados: number }[]>([]);
  const [editFuncSelecionados, setEditFuncSelecionados] = useState<string[]>([]);
  const [diaOffset, setDiaOffset] = useState(0);
  const [decisoesAlvoIds, setDecisoesAlvoIds] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResumo, setAiResumo] = useState<string | null>(null);
  const [aiAtivo, setAiAtivo] = useState(false);
  const [presencas, setPresencas] = useState<any[]>([]);

  const hoje = new Date();
  const diasDisponiveis = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dataAlvo = diasDisponiveis[diaOffset] || hoje;
  const diaSemana = dataAlvo.getDay();
  const escalaDoDia = factoryId === ERA_DOS_SABORES_ID ? (ESCALA_ERA_DOS_SABORES[diaSemana] || []) : [];

  const dataAlvoLabel = dataAlvo.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

  useEffect(() => {
    calcular();
    fetchHistorico();
    fetchPresencas();
  }, [diaOffset]);

  async function fetchPresencas() {
    const d = diasDisponiveis[diaOffset] || new Date();
    const alvoIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let pq = (supabase as any)
      .from("presenca_producao")
      .select("*, funcionarios(nome)")
      .eq("data", alvoIso);
    if (factoryId) pq = pq.eq("factory_id", factoryId);
    const { data } = await pq;
    setPresencas(data || []);
  }

  async function fetchHistorico() {
    try {
      let hq = (supabase as any)
        .from("decisoes_producao")
        .select("*")
        .gt("lotes_autorizados", 0)
        .order("created_at", { ascending: false })
        .limit(500);
      if (factoryId) hq = hq.eq("factory_id", factoryId);
      const { data, error } = await hq;
      if (error) throw error;

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

  async function handleDeleteRegistro() {
    if (!deleteRegistro) return;
    try {
      const ids = deleteRegistro.itens.map((i: any) => i.id);
      const { error } = await (supabase as any)
        .from("decisoes_producao")
        .delete()
        .in("id", ids);
      if (error) throw error;
      toast({ title: "Plano excluído com sucesso!" });
      setDeleteRegistro(null);
      fetchHistorico();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }

  function openEditRegistro(registro: any) {
    setEditRegistro(registro);
    setEditItens(registro.itens.map((i: any) => ({
      id: i.id,
      sabor_nome: i.sabor_nome,
      lotes_autorizados: i.lotes_autorizados,
    })));
    const operadorStr: string = registro.operador || "";
    const nomes = operadorStr.split(",").map((n: string) => n.trim()).filter(Boolean);
    const ids = nomes.map((nome: string) => {
      if (nome.toLowerCase() === "patrões") return "patroes";
      const found = funcionarios.find((f: any) => f.nome.toLowerCase() === nome.toLowerCase());
      return found ? found.id : "";
    }).filter((id: string) => id !== "");
    setEditFuncSelecionados(ids.length > 0 ? ids : [""]);
  }

  async function handleSaveEdit() {
    if (!editRegistro) return;
    try {
      const validFuncs = editFuncSelecionados.filter(f => f !== "");
      const nomesFuncionarios = validFuncs
        .map(f => f === "patroes" ? "Patrões" : funcionarios.find((fn: any) => fn.id === f)?.nome)
        .filter(Boolean)
        .join(", ");

      for (const item of editItens) {
        const updatePayload: any = { lotes_autorizados: item.lotes_autorizados };
        if (nomesFuncionarios) updatePayload.operador = nomesFuncionarios;
        await (supabase as any)
          .from("decisoes_producao")
          .update(updatePayload)
          .eq("id", item.id);
      }

      if (nomesFuncionarios) {
        const alvoDate = editRegistro.itens[0]?.created_at ? new Date(editRegistro.itens[0].created_at) : null;
        if (alvoDate) {
          const alvoStr = `${alvoDate.getFullYear()}-${String(alvoDate.getMonth() + 1).padStart(2, "0")}-${String(alvoDate.getDate()).padStart(2, "0")}`;
          localStorage.setItem(`checklist-producao-${alvoStr}-funcs`, JSON.stringify(validFuncs));
          localStorage.setItem(`checklist-producao-${alvoStr}-operador`, nomesFuncionarios);
        }
      }

      toast({ title: "Plano atualizado!" });
      setEditRegistro(null);
      fetchHistorico();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  }

  async function calcular() {
    setLoading(true);
    try {
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() - 30);

      const [vendasRes, gelosRes, saboresRes, funcsRes, decisoesRes, producoesRes, vendaItensRecentesRes] = await Promise.all([
        (supabase as any).from("venda_itens").select("sabor_id, quantidade, vendas!inner(created_at, status)"),
        (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome, id)"),
        (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome"),
        (supabase as any).from("funcionarios").select("id, nome").eq("ativo", true).order("nome"),
        (supabase as any).from("decisoes_producao").select("*").order("created_at", { ascending: false }).limit(500),
        (supabase as any).from("producoes").select("sabor_id, quantidade_total, created_at").gte("created_at", trintaDias.toISOString()),
        (supabase as any).from("venda_itens").select("sabor_id, quantidade, vendas!inner(created_at, status)").gte("vendas.created_at", trintaDias.toISOString()).neq("vendas.status", "cancelada"),
      ]);

      const funcs = funcsRes.data || [];
      setFuncionarios(funcs);

      if (escalaDoDia.length > 0) {
        const ids = escalaDoDia
          .map(nome => funcs.find((f: any) => f.nome.toLowerCase().includes(nome)))
          .filter(Boolean)
          .map((f: any) => f.id);
        if (ids.length > 0) setFuncSelecionados(ids);
        else setFuncSelecionados([""]);
      } else {
        // Garantir pelo menos um slot vazio para seleção manual
        setFuncSelecionados(prev => prev.length === 0 ? [""] : prev);
      }

      const decisoes = decisoesRes.data || [];
      const producoes = producoesRes.data || [];
      const vendaItensRecentes = (vendaItensRecentesRes.data || []).filter((v: any) => v.vendas?.status !== "cancelada");
      
      const diasUnicos = new Set(
        decisoes.map((d: any) => new Date(d.created_at).toISOString().slice(0, 10))
      );
      setTotalDecisoes(diasUnicos.size);
      
      if (diasUnicos.size >= ACTIVATION_THRESHOLD) setModoIA(true);

      // Check if target date's plan was already authorized
      const alvoIso = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, "0")}-${String(dataAlvo.getDate()).padStart(2, "0")}`;
      const decisoesAlvo = decisoes.filter((d: any) => {
        const dDate = new Date(d.created_at);
        const dStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, "0")}-${String(dDate.getDate()).padStart(2, "0")}`;
        return dStr === alvoIso && d.lotes_autorizados > 0;
      });

      if (decisoesAlvo.length > 0) {
        setPlanoHojeJaFeito(true);
        setExecutado(true);
        setDecisoesAlvoIds(decisoesAlvo.map((d: any) => d.id));
      } else {
        setPlanoHojeJaFeito(false);
        setExecutado(false);
        setDecisoesAlvoIds([]);
      }

      const vendaItens = (vendasRes.data || []).filter((v: any) => v.vendas?.status !== "cancelada");
      const gelos = gelosRes.data || [];
      const saboresAtivos = saboresRes.data || [];

      const agora = new Date();
      const seteDias = new Date(agora); seteDias.setDate(seteDias.getDate() - 7);
      const trintaDiasAgo = new Date(agora); trintaDiasAgo.setDate(trintaDiasAgo.getDate() - 30);

      const vendaMap: Record<string, { v7d: number; v30d: number }> = {};
      vendaItens.forEach((item: any) => {
        const id = item.sabor_id;
        if (!vendaMap[id]) vendaMap[id] = { v7d: 0, v30d: 0 };
        const dt = new Date(item.vendas?.created_at);
        if (dt >= seteDias) vendaMap[id].v7d += item.quantidade;
        if (dt >= trintaDiasAgo) vendaMap[id].v30d += item.quantidade;
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

        // Learning engine with graduated confidence
        const aprendizado = calcularAprendizado(decisoes, sabor.id, diaSemana, loteSugerido);

        // Feedback loop
        const feedback = calcularFeedback(decisoes, producoes, vendaItensRecentes, sabor.id);

        // Only auto-fill when confidence is HIGH (85%+)
        const usarAprendido = modoIA && aprendizado.loteAprendido !== null && aprendizado.nivelConfianca === "alta";
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
          nivelConfianca: aprendizado.nivelConfianca,
          feedbackScore: feedback.feedbackScore,
          feedbackLabel: feedback.feedbackLabel,
          // AI fields will be populated separately
          aiLotes: null,
          aiConfianca: null,
          aiJustificativa: null,
          aiFeedbackNota: null,
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

      // Normalizar para que o total sugerido seja sempre 6 lotes (504 unidades)
      const META_LOTES_TOTAL = 6;
      const totalSugerido = result.reduce((s, r) => s + r.lotesCustom, 0);
      if (totalSugerido > 0 && totalSugerido !== META_LOTES_TOTAL) {
        // Distribuir proporcionalmente, priorizando quem tem mais deficit
        const comLotes = result.filter(r => r.lotesCustom > 0);
        if (comLotes.length > 0) {
          // Reset all to 0 first
          result.forEach(r => { r.lotesCustom = 0; r.selecionado = false; });
          
          let restante = META_LOTES_TOTAL;
          // Distribute proportionally
          const totalOriginal = comLotes.reduce((s, r) => s + r.loteSugerido, 0) || comLotes.length;
          for (let i = 0; i < comLotes.length && restante > 0; i++) {
            const prop = totalOriginal > 0 
              ? Math.round((comLotes[i].loteSugerido / totalOriginal) * META_LOTES_TOTAL)
              : Math.round(META_LOTES_TOTAL / comLotes.length);
            const lotes = Math.max(i < comLotes.length - 1 ? Math.min(prop, restante) : restante, 0);
            const item = result.find(r => r.id === comLotes[i].id)!;
            item.lotesCustom = Math.min(lotes, restante);
            item.selecionado = item.lotesCustom > 0;
            restante -= item.lotesCustom;
          }
          // If there's remainder, give to the first item
          if (restante > 0) {
            const first = result.find(r => r.lotesCustom > 0) || result[0];
            first.lotesCustom += restante;
            first.selecionado = true;
          }
        }
      }

      setAnalises(result);
    } catch (e) {
      console.error("Erro ao calcular plano:", e);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Call AI for smart suggestions
  async function consultarIA() {
    setAiLoading(true);
    setAiResumo(null);
    try {
      const saboresPayload = analises.map(a => ({
        id: a.id,
        nome: a.nome,
        estoqueAtual: a.estoqueAtual,
        vendas7d: a.vendas7d,
        mediaDiaria: a.mediaDiaria,
        diasCobertura: a.diasCobertura,
        tendencia: a.tendencia,
      }));

      const { data, error } = await supabase.functions.invoke("suggest-producao", {
        body: { dia_semana: diaSemana, sabores_analise: saboresPayload },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro da IA", description: data.error, variant: "destructive" });
        return;
      }

      const sugestoes: any[] = data?.sugestoes || [];
      setAiResumo(data?.resumo || null);
      setAiAtivo(true);

      // Merge AI suggestions into analises, then normalize to 6 total
      const META_LOTES_TOTAL = 6;
      setAnalises(prev => {
        let updated = prev.map(a => {
          const sug = sugestoes.find((s: any) => 
            s.sabor_nome?.toLowerCase() === a.nome.toLowerCase() ||
            a.nome.toLowerCase().includes(s.sabor_nome?.toLowerCase() || "___")
          );
          if (sug) {
            return {
              ...a,
              aiLotes: sug.lotes,
              aiConfianca: sug.confianca,
              aiJustificativa: sug.justificativa,
              aiFeedbackNota: sug.feedback_nota || null,
              lotesCustom: sug.lotes,
              selecionado: sug.lotes > 0,
            };
          }
          return a;
        });

        // Normalize to META_LOTES_TOTAL
        const totalSugerido = updated.reduce((s, r) => s + (r.selecionado ? r.lotesCustom : 0), 0);
        if (totalSugerido > 0 && totalSugerido !== META_LOTES_TOTAL) {
          const comLotes = updated.filter(r => r.lotesCustom > 0 && r.selecionado);
          if (comLotes.length > 0) {
            const totalOrig = comLotes.reduce((s, r) => s + r.lotesCustom, 0);
            let restante = META_LOTES_TOTAL;
            updated = updated.map(r => ({ ...r, lotesCustom: r.selecionado ? 0 : r.lotesCustom, selecionado: false }));
            for (let i = 0; i < comLotes.length && restante > 0; i++) {
              const prop = Math.round((comLotes[i].lotesCustom / totalOrig) * META_LOTES_TOTAL);
              const lotes = i < comLotes.length - 1 ? Math.min(Math.max(prop, 1), restante) : restante;
              const item = updated.find(r => r.id === comLotes[i].id)!;
              item.lotesCustom = lotes;
              item.selecionado = true;
              restante -= lotes;
            }
            if (restante > 0) {
              const first = updated.find(r => r.selecionado)!;
              first.lotesCustom += restante;
            }
          }
        }
        return updated;
      });

      toast({ title: "🤖 Sugestões da IA aplicadas!", description: data?.resumo });
    } catch (e: any) {
      console.error("Erro ao consultar IA:", e);
      toast({ title: "Erro ao consultar IA", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
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

  async function registrarDecisoes(itens: SaborAnalise[]) {
    const validFuncs = funcSelecionados.filter(f => f !== "");
    const operador = validFuncs
      .map(f => f === "patroes" ? "Patrões" : funcionarios.find(fn => fn.id === f)?.nome)
      .filter(Boolean)
      .join(", ") || "sistema";

    const alvoIso = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, "0")}-${String(dataAlvo.getDate()).padStart(2, "0")}T08:00:00-03:00`;

    // Build rows WITHOUT 'ajuste' (it's a generated column in DB)
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
      created_at: alvoIso,
    }));

    const { error } = await (supabase as any).from("decisoes_producao").insert(rows);
    if (error) throw error;
  }

  async function editarPlanoExistente() {
    if (decisoesAlvoIds.length === 0) return;
    try {
      await (supabase as any)
        .from("decisoes_producao")
        .delete()
        .in("id", decisoesAlvoIds);
      setDecisoesAlvoIds([]);
      setPlanoHojeJaFeito(false);
      setExecutado(false);
      toast({ title: "Plano desbloqueado para edição" });
    } catch (e: any) {
      toast({ title: "Erro ao desbloquear", description: e.message, variant: "destructive" });
    }
  }

  async function autorizarProducao() {
    const itens = analises.filter(a => a.selecionado && a.lotesCustom > 0);
    if (itens.length === 0) return toast({ title: "Selecione ao menos um sabor", variant: "destructive" });

    const validFuncs = funcSelecionados.filter(f => f !== "");
    if (validFuncs.length === 0) return toast({ title: "Selecione ao menos um responsável", variant: "destructive" });

    const nomesFuncionarios = validFuncs
      .map(f => f === "patroes" ? "Patrões" : funcionarios.find(fn => fn.id === f)?.nome)
      .filter(Boolean)
      .join(", ");

    setExecutando(true);
    try {
      await registrarDecisoes(itens);

      const alvoStr = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, "0")}-${String(dataAlvo.getDate()).padStart(2, "0")}`;
      const CHECKLIST_KEY = `checklist-producao-${alvoStr}`;
      localStorage.setItem(`${CHECKLIST_KEY}-funcs`, JSON.stringify(validFuncs));
      localStorage.setItem(`${CHECKLIST_KEY}-operador`, nomesFuncionarios || "sistema");

      const totalLotesCalc = itens.reduce((s, i) => s + i.lotesCustom, 0);
      const totalUnidadesCalc = totalLotesCalc * 84;
      const labelDia = diaOffset > 0 ? `para ${dataAlvo.toLocaleDateString("pt-BR")}` : "de hoje";
      const producaoUrl = `/painel/producao?data=${alvoStr}`;

      toast({
        title: "✅ Plano autorizado!",
        description: `${itens.length} sabor(es) · ${totalLotesCalc} lote(s) · ${totalUnidadesCalc.toLocaleString()} un ${labelDia} — vá para Produção para acompanhar o checklist.`,
        action: (
          <ToastAction altText="Abrir produção" onClick={() => navigate(producaoUrl)}>
            Abrir Produção
          </ToastAction>
        ),
      });

      setExecutado(true);
      setPlanoHojeJaFeito(true);
      fetchHistorico();
    } catch (e: any) {
      toast({ title: "Erro ao autorizar", description: e.message, variant: "destructive" });
    } finally {
      setExecutando(false);
    }
  }

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

  const confiancaBadge = (nivel: string, valor: number) => {
    const configs = {
      alta: { color: "border-green-400/50 text-green-600 bg-green-50", icon: "🎯", label: "Alta" },
      media: { color: "border-amber-400/50 text-amber-600 bg-amber-50", icon: "📊", label: "Média" },
      baixa: { color: "border-orange-400/50 text-orange-600 bg-orange-50", icon: "📉", label: "Baixa" },
      insuficiente: { color: "border-muted text-muted-foreground", icon: "❓", label: "Aprendendo" },
    };
    const cfg = configs[nivel as keyof typeof configs] || configs.insuficiente;
    return (
      <Badge variant="outline" className={`text-[9px] h-4 px-1 gap-0.5 ${cfg.color}`}>
        {cfg.icon} {valor}%
      </Badge>
    );
  };


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
              {dataAlvoLabel} · {selecionados.length} de {analises.length} sabores · {totalLotes} lotes · {totalUnidades.toLocaleString()} un
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); calcular(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </div>

      {/* Seletor de dias */}
      <div className="flex gap-2 flex-wrap">
        {diasDisponiveis.map((dia, i) => (
          <Button
            key={i}
            variant={diaOffset === i ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setDiaOffset(i)}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {i === 0 ? "Hoje" : dia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </Button>
        ))}
      </div>

      {/* Painel de Estoque Atual */}
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

      {/* Learning + AI status card */}
      <Card className={`border-dashed ${totalDecisoes >= ACTIVATION_THRESHOLD ? "border-primary/40 bg-primary/5" : "border-muted"}`}>
        <CardContent className="py-3 px-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className={`h-4 w-4 ${totalDecisoes >= ACTIVATION_THRESHOLD ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-xs font-semibold">
                  {totalDecisoes < 10
                    ? "🧠 Aprendendo... (fase inicial)"
                    : totalDecisoes < ACTIVATION_THRESHOLD
                      ? `🧠 Coletando padrões... (${totalDecisoes}/${ACTIVATION_THRESHOLD})`
                      : totalDecisoes < 40
                        ? "🧠 Sugestões com confiança graduada"
                        : "🤖 Modo inteligente avançado"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {totalDecisoes} sessões · Confiança média: {confiancaMedia}%
                  {totalDecisoes >= ACTIVATION_THRESHOLD && " · Auto-preenche ≥85%"}
                </p>
              </div>
            </div>
            {totalDecisoes >= ACTIVATION_THRESHOLD && (
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

          {/* Progress bar for pre-activation */}
          {totalDecisoes < ACTIVATION_THRESHOLD && (
            <div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, (totalDecisoes / ACTIVATION_THRESHOLD) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {ACTIVATION_THRESHOLD - totalDecisoes} sessões restantes para ativar sugestões inteligentes
              </p>
            </div>
          )}

          {/* Confidence legend */}
          {totalDecisoes >= ACTIVATION_THRESHOLD && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-dashed">
              <span className="text-[10px] text-muted-foreground">Níveis:</span>
              <Badge variant="outline" className="text-[9px] h-4 border-green-400/50 text-green-600 bg-green-50">🎯 Alta (≥85%) → Auto</Badge>
              <Badge variant="outline" className="text-[9px] h-4 border-amber-400/50 text-amber-600 bg-amber-50">📊 Média (50-84%) → Sugestão</Badge>
              <Badge variant="outline" className="text-[9px] h-4 border-orange-400/50 text-orange-600 bg-orange-50">📉 Baixa (&lt;50%)</Badge>
            </div>
          )}

          {/* AI Generative button */}
          <div className="flex items-center gap-2 pt-1 border-t border-dashed">
            <Button
              variant={aiAtivo ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1.5 flex-1"
              onClick={consultarIA}
              disabled={aiLoading || analises.length === 0}
            >
              {aiLoading ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analisando padrões...</>
              ) : (
                <><Zap className="h-3.5 w-3.5" /> {aiAtivo ? "Reconsultar IA Generativa" : "🚀 Consultar IA Generativa"}</>
              )}
            </Button>
          </div>

          {/* AI resume */}
          {aiResumo && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
              <Zap className="h-3.5 w-3.5 text-violet-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-violet-700 dark:text-violet-300">{aiResumo}</p>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Escala do dia */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Escala — {dataAlvoLabel}
            </p>
            {escalaDoDia.length > 0 && (
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
                    <SelectValue placeholder="Colaborador" />
                  </SelectTrigger>
                   <SelectContent>
                    <SelectItem value="patroes">👑 Patrões</SelectItem>
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

      {/* Presença dos Colaboradores */}
      {presencas.length > 0 && (
        <Card className="border-dashed border-green-500/30 bg-green-500/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" /> Presença Confirmada
              </p>
              <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600">
                {presencas.length} colaborador(es)
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {presencas.map((p: any) => (
                <Badge key={p.id} className="bg-green-600 text-white text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {p.funcionarios?.nome || "?"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist de sabores */}
      <div className="space-y-2">
        {analises.map((a) => {
          const color = getSaborColor(a.nome);
          const isSelected = a.selecionado && a.lotesCustom > 0;
          const coberturaPercent = Math.min(100, (a.diasCobertura / 14) * 100);
          const hasLearning = a.loteAprendido !== null && a.confianca >= 20;

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
              <CardContent className="py-3 px-3">
                <div className="flex items-center gap-2">
                  {/* Check circle */}
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isSelected ? "scale-110" : "bg-muted"
                    }`}
                    style={isSelected ? { backgroundColor: color, boxShadow: `0 0 12px ${color}40` } : {}}
                  >
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    )}
                  </div>

                  {/* Nome + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`font-bold text-sm truncate ${isSelected ? "" : "text-muted-foreground"}`}>
                        {a.prioritario && (
                          <span className="text-xs font-black mr-1" style={{ color }}>#{a.ordemPrioridade + 1}</span>
                        )}
                        {a.nome}
                      </span>
                      {a.prioritario && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary shrink-0">
                          PRIORIDADE
                        </Badge>
                      )}
                      {hasLearning && modoIA && confiancaBadge(a.nivelConfianca, a.confianca)}
                      {a.aiConfianca && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-violet-400/50 text-violet-600 bg-violet-50 shrink-0">
                          <Zap className="h-2.5 w-2.5" /> IA
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Tendência */}
                  <div className="shrink-0">
                    {tendenciaIcon(a.tendencia)}
                  </div>
                </div>

                {/* Controles de lote */}
                <div className="mt-2 ml-9 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-1.5 py-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full text-lg font-black"
                      onClick={() => {
                        const newVal = Math.max(0, a.lotesCustom - 1);
                        setLotes(a.id, newVal);
                        if (newVal === 0 && a.selecionado) toggleSabor(a.id);
                      }}
                    >
                      −
                    </Button>

                    <div className="text-center w-14">
                      <Input
                        type="number"
                        min={0}
                        value={a.lotesCustom}
                        onChange={(e) => {
                          const newVal = Math.max(0, Number(e.target.value) || 0);
                          setLotes(a.id, newVal);
                          if (newVal > 0 && !a.selecionado) toggleSabor(a.id);
                          if (newVal === 0 && a.selecionado) toggleSabor(a.id);
                        }}
                        className="h-8 w-14 text-center text-lg font-black p-0 border-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ color: isSelected ? color : "hsl(var(--foreground))" }}
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full text-lg font-black"
                      onClick={() => {
                        const newVal = a.lotesCustom + 1;
                        setLotes(a.id, newVal);
                        if (!a.selecionado) toggleSabor(a.id);
                      }}
                    >
                      +
                    </Button>
                  </div>

                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {a.lotesCustom * 84} un
                  </p>
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-2 mt-1.5 ml-9">
                  <div className="flex-1 max-w-[100px]">
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
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
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

                {/* Feedback loop indicator */}
                {a.feedbackScore !== null && a.feedbackScore > 0 && (
                  <div className="flex items-center gap-1 text-[10px] mt-1 ml-9">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className={
                      a.feedbackLabel.includes("✅") ? "text-green-600" :
                      a.feedbackLabel.includes("📈") ? "text-blue-600" :
                      a.feedbackLabel.includes("⚠️") ? "text-amber-600" :
                      "text-destructive"
                    }>
                      {a.feedbackLabel}
                    </span>
                  </div>
                )}

                {/* Learning insight */}
                {hasLearning && modoIA && (
                  <div className="flex items-center gap-1 text-[10px] text-violet-600 mt-1 ml-9">
                    <Brain className="h-3 w-3" />
                    {a.nivelConfianca === "alta" ? (
                      <span>Auto-preenchido: {a.loteAprendido} lote(s) — padrão consistente</span>
                    ) : a.nivelConfianca === "media" ? (
                      <span>Sugestão: {a.loteAprendido} lote(s) — confirme ou ajuste</span>
                    ) : (
                      <span>Aprendendo padrão... ({a.historicoAjustes} ajuste(s) registrado(s))</span>
                    )}
                  </div>
                )}

                {/* AI insight */}
                {a.aiJustificativa && (
                  <div className="flex items-center gap-1 text-[10px] text-violet-700 mt-1 ml-9">
                    <Zap className="h-3 w-3" />
                    <span>{a.aiJustificativa}</span>
                    {a.aiFeedbackNota && (
                      <span className="text-muted-foreground ml-1">· {a.aiFeedbackNota}</span>
                    )}
                  </div>
                )}

                {/* Alerta */}
                {a.diasCobertura <= 3 && a.diasCobertura !== 999 && (
                  <div className="flex items-center gap-1 text-[10px] text-destructive mt-1 ml-9">
                    <AlertTriangle className="h-3 w-3" /> Estoque crítico — risco de ruptura
                  </div>
                )}
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{registro.totalLotes} lotes · {registro.totalUnidades.toLocaleString()} un</span>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditRegistro(registro)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteRegistro(registro)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
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
      {(selecionados.length > 0 || (diaOffset > 0 && executado && decisoesAlvoIds.length > 0)) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/80 backdrop-blur-lg border-t">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ProgressRing progress={progressTotal} color="hsl(var(--primary))" size={44} />
                <div className="absolute inset-0 flex items-center justify-center">
                  {aiAtivo ? <Zap className="h-4 w-4 text-primary" /> : modoIA ? <Brain className="h-4 w-4 text-primary" /> : <Snowflake className="h-4 w-4 text-primary" />}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold">
                  {selecionados.length} sabor(es)
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalLotes} lotes · {totalUnidades.toLocaleString()} un
                  {aiAtivo ? " · 🚀 IA Gen" : modoIA ? " · 🧠 IA" : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {diaOffset > 0 && executado && decisoesAlvoIds.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={editarPlanoExistente}
                  className="gap-2 rounded-full px-6"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              )}
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
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteRegistro} onOpenChange={(open) => !open && setDeleteRegistro(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano de {deleteRegistro?.dia}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRegistro} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editRegistro} onOpenChange={(open) => !open && setEditRegistro(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Plano — {editRegistro?.dia}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editItens.map((item, idx) => {
              const color = getSaborColor(item.sabor_nome);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium flex-1">{item.sabor_nome}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm" className="h-8 w-8 p-0"
                      onClick={() => {
                        const updated = [...editItens];
                        updated[idx].lotes_autorizados = Math.max(0, updated[idx].lotes_autorizados - 1);
                        setEditItens(updated);
                      }}
                    >−</Button>
                    <Input
                      type="number"
                      className="w-16 h-8 text-center text-sm"
                      value={item.lotes_autorizados}
                      onChange={(e) => {
                        const updated = [...editItens];
                        updated[idx].lotes_autorizados = Math.max(0, Number(e.target.value));
                        setEditItens(updated);
                      }}
                    />
                    <Button
                      variant="outline" size="sm" className="h-8 w-8 p-0"
                      onClick={() => {
                        const updated = [...editItens];
                        updated[idx].lotes_autorizados += 1;
                        setEditItens(updated);
                      }}
                    >+</Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right">
                    {item.lotes_autorizados * 84}un
                  </span>
                </div>
              );
            })}
            {/* Colaboradores */}
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Colaboradores</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditFuncSelecionados(prev => [...prev, ""])}>
                  + Adicionar
                </Button>
              </div>
              {editFuncSelecionados.map((fId, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <Select value={fId} onValueChange={(v) => {
                    setEditFuncSelecionados(prev => { const list = [...prev]; list[i] = v; return list; });
                  }}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patroes">👑 Patrões</SelectItem>
                      {funcionarios.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editFuncSelecionados.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => {
                      setEditFuncSelecionados(prev => prev.filter((_, idx) => idx !== i));
                    }}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-bold">
                Total: {editItens.reduce((s, i) => s + i.lotes_autorizados, 0)} lotes · {editItens.reduce((s, i) => s + i.lotes_autorizados * 84, 0)} un
              </span>
              <Button onClick={handleSaveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
