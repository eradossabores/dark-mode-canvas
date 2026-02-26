import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Factory, TrendingUp, TrendingDown, Minus, RefreshCw,
  AlertTriangle, CheckCircle2, Snowflake, BarChart3, Check, X,
  Brain, Sparkles, History, ChevronDown, ChevronUp, CalendarDays,
  Trash2, Pencil
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


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

function getProximoDiaUtil(a_partir_de: Date): Date {
  const d = new Date(a_partir_de);
  d.setDate(d.getDate() + 1);
  // Avança até Terça-Sexta (2-5)
  while (d.getDay() < 2 || d.getDay() > 5) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export default function PlanoProducaoDiario() {
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
  const [planejandoAmanha, setPlanejandoAmanha] = useState(false);
  const [decisoesAlvoIds, setDecisoesAlvoIds] = useState<string[]>([]);

  const hoje = new Date();
  const proximoDiaUtil = getProximoDiaUtil(hoje);
  const dataAlvo = planejandoAmanha ? proximoDiaUtil : hoje;
  const diaSemana = dataAlvo.getDay();
  const diaProducao = diaSemana >= 2 && diaSemana <= 5;
  const escalaDoDia = ESCALA_PRODUCAO[diaSemana] || [];

  const dataAlvoLabel = dataAlvo.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

  useEffect(() => {
    calcular();
    fetchHistorico();
  }, [planejandoAmanha]);

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
  }

  async function handleSaveEdit() {
    if (!editRegistro) return;
    try {
      for (const item of editItens) {
        await (supabase as any)
          .from("decisoes_producao")
          .update({ lotes_autorizados: item.lotes_autorizados })
          .eq("id", item.id);
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
    // Don't reset executado if we're reloading after authorization
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

      // Check if target date's plan was already authorized (from DB)
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

    // Use target date for created_at so next-day plans are saved on correct date
    const alvoIso = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, "0")}-${String(dataAlvo.getDate()).padStart(2, "0")}T08:00:00`;

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

    await (supabase as any).from("decisoes_producao").insert(rows);
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
      .map(f => funcionarios.find(fn => fn.id === f)?.nome)
      .filter(Boolean)
      .join(", ");

    setExecutando(true);
    try {
      await registrarDecisoes(itens);

      // Save func info for ChecklistProducaoDia component (use target date)
      const alvoStr = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, "0")}-${String(dataAlvo.getDate()).padStart(2, "0")}`;
      const CHECKLIST_KEY = `checklist-producao-${alvoStr}`;
      localStorage.setItem(`${CHECKLIST_KEY}-funcs`, JSON.stringify(validFuncs));
      localStorage.setItem(`${CHECKLIST_KEY}-operador`, nomesFuncionarios || "sistema");

      const totalLotes = itens.reduce((s, i) => s + i.lotesCustom, 0);
      const totalUnidades = totalLotes * 84;
      const labelDia = planejandoAmanha ? `para ${dataAlvo.toLocaleDateString("pt-BR")}` : "de hoje";
      toast({
        title: "✅ Plano autorizado!",
        description: `${itens.length} sabor(es) · ${totalLotes} lote(s) · ${totalUnidades.toLocaleString()} un ${labelDia} — vá para Produção para acompanhar o checklist.`,
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

      {/* Seletor Hoje / Próximo dia útil */}
      <div className="flex gap-2">
        <Button
          variant={!planejandoAmanha ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setPlanejandoAmanha(false)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Hoje
        </Button>
        <Button
          variant={planejandoAmanha ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setPlanejandoAmanha(true)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {proximoDiaUtil.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
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
            <p className="font-bold text-sm">{dataAlvoLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
              A produção opera de <strong>Terça a Sexta-feira</strong>. {planejandoAmanha ? "Esse dia não tem produção." : "Você ainda pode planejar para o próximo dia útil."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Escala do dia */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Escala — {dataAlvoLabel}
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
      {(selecionados.length > 0 || (planejandoAmanha && executado && decisoesAlvoIds.length > 0)) && (
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
            <div className="flex gap-2">
              {planejandoAmanha && executado && decisoesAlvoIds.length > 0 && (
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
