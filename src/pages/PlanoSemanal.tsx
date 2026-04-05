import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays, Plus, Trash2, Save, ArrowLeft, Pencil,
  TrendingDown, AlertTriangle, CheckCircle2,
  Copy, BarChart3, Sparkles, Package, X, Check, ChevronLeft, ChevronRight,
  Bot, Loader2, Brain, Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

const DIAS_SEMANA = [
  { value: 1, label: "Segunda", short: "Seg", gradient: "from-blue-500/15 to-blue-600/5", border: "border-blue-500/25", headerBg: "bg-blue-500/10" },
  { value: 2, label: "Terça", short: "Ter", gradient: "from-violet-500/15 to-violet-600/5", border: "border-violet-500/25", headerBg: "bg-violet-500/10" },
  { value: 3, label: "Quarta", short: "Qua", gradient: "from-emerald-500/15 to-emerald-600/5", border: "border-emerald-500/25", headerBg: "bg-emerald-500/10" },
  { value: 4, label: "Quinta", short: "Qui", gradient: "from-amber-500/15 to-amber-600/5", border: "border-amber-500/25", headerBg: "bg-amber-500/10" },
  { value: 5, label: "Sexta", short: "Sex", gradient: "from-rose-500/15 to-rose-600/5", border: "border-rose-500/25", headerBg: "bg-rose-500/10" },
  { value: 6, label: "Sábado", short: "Sáb", gradient: "from-cyan-500/15 to-cyan-600/5", border: "border-cyan-500/25", headerBg: "bg-cyan-500/10" },
  { value: 0, label: "Domingo", short: "Dom", gradient: "from-orange-500/15 to-orange-600/5", border: "border-orange-500/25", headerBg: "bg-orange-500/10" },
];

const PRIORIDADE_SABORES = ["melancia", "maçã verde", "morango", "maracujá", "água de coco"];

const SABOR_COLORS: Record<string, string> = {
  melancia: "#ef4444", "maçã verde": "#22c55e", morango: "#f43f5e",
  maracujá: "#f59e0b", "água de coco": "#06b6d4", "bob marley": "#a3e635",
  abacaxi: "#eab308", limão: "#84cc16", pitaya: "#d946ef", "blue ice": "#3b82f6",
  "gelo azul": "#3b82f6", "tadala": "#8b5cf6",
};

function getSaborColor(nome: string): string {
  const lower = nome.toLowerCase();
  for (const [key, color] of Object.entries(SABOR_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#8b5cf6";
}

interface PlanItem {
  id: string;
  sabor_id: string;
  dia_semana: number;
  quantidade: number;
  editing?: boolean;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function PlanoSemanal() {
  const { factoryId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sabores, setSabores] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<Record<string, number>>({});
  const [itens, setItens] = useState<PlanItem[]>([]);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [planoNome, setPlanoNome] = useState("Plano Semanal");
  const [weekOffset, setWeekOffset] = useState(0);
  const [planosExistentes, setPlanosExistentes] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [vendas7d, setVendas7d] = useState<Record<string, number>>({});
  const [mediaDiaria, setMediaDiaria] = useState<Record<string, number>>({});
  const [gelosPorLote, setGelosPorLote] = useState<Record<string, number>>({});
  const [sugestaoGerada, setSugestaoGerada] = useState(false);
  const [vendasPorDia, setVendasPorDia] = useState<Record<number, Record<string, number>>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResumo, setAiResumo] = useState<string | null>(null);
  const [aiAtivo, setAiAtivo] = useState(false);
  const [aiJustificativas, setAiJustificativas] = useState<Record<string, Record<number, { confianca: string; justificativa: string }>>>({});

  const mondayOfWeek = useMemo(() => {
    const now = new Date();
    const mon = getMonday(now);
    mon.setDate(mon.getDate() + weekOffset * 7);
    return mon;
  }, [weekOffset]);

  const semanaLabel = useMemo(() => {
    const end = new Date(mondayOfWeek);
    end.setDate(end.getDate() + 6);
    return `${mondayOfWeek.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} — ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }, [mondayOfWeek]);

  useEffect(() => { fetchData(); }, [weekOffset]);

  async function fetchData() {
    setLoading(true);
    try {
      let qSabores = (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome");
      let qEstoque = (supabase as any).from("estoque_gelos").select("sabor_id, quantidade");
      let qVendas = (supabase as any).from("venda_itens").select("sabor_id, quantidade, vendas!inner(created_at, status)").neq("vendas.status", "cancelada");
      let qPlanos = (supabase as any).from("planos_semanais").select("*").order("created_at", { ascending: false }).limit(20);
      let qReceitas = (supabase as any).from("sabor_receita").select("sabor_id, gelos_por_lote");

      if (factoryId) {
        qSabores = qSabores.eq("factory_id", factoryId);
        qEstoque = qEstoque.eq("factory_id", factoryId);
        qPlanos = qPlanos.eq("factory_id", factoryId);
        qReceitas = qReceitas.eq("factory_id", factoryId);
      }

      const [saboresRes, estoqueRes, vendasRes, planosRes, receitasRes] = await Promise.all([qSabores, qEstoque, qVendas, qPlanos, qReceitas]);

      const saboresData = saboresRes.data || [];
      setSabores(saboresData);

      const estoqueMap: Record<string, number> = {};
      (estoqueRes.data || []).forEach((e: any) => { estoqueMap[e.sabor_id] = e.quantidade; });
      setEstoque(estoqueMap);

      const gplMap: Record<string, number> = {};
      (receitasRes.data || []).forEach((r: any) => { gplMap[r.sabor_id] = r.gelos_por_lote; });
      setGelosPorLote(gplMap);

      const now = new Date();
      const seteDias = new Date(now); seteDias.setDate(seteDias.getDate() - 7);
      const trintaDias = new Date(now); trintaDias.setDate(trintaDias.getDate() - 30);

      const v7d: Record<string, number> = {};
      const v30d: Record<string, number> = {};
      const vpd: Record<number, Record<string, number>> = {};

      (vendasRes.data || []).forEach((v: any) => {
        const dt = new Date(v.vendas?.created_at);
        const dow = dt.getDay();
        if (dt >= seteDias) v7d[v.sabor_id] = (v7d[v.sabor_id] || 0) + v.quantidade;
        if (dt >= trintaDias) {
          v30d[v.sabor_id] = (v30d[v.sabor_id] || 0) + v.quantidade;
          if (!vpd[dow]) vpd[dow] = {};
          vpd[dow][v.sabor_id] = (vpd[dow][v.sabor_id] || 0) + v.quantidade;
        }
      });
      setVendas7d(v7d);
      setVendasPorDia(vpd);
      const md: Record<string, number> = {};
      Object.entries(v30d).forEach(([sid, qty]) => { md[sid] = Math.round((qty as number) / 30); });
      setMediaDiaria(md);

      setPlanosExistentes(planosRes.data || []);

      const mondayStr = mondayOfWeek.toISOString().slice(0, 10);
      const existingPlan = (planosRes.data || []).find((p: any) => p.semana_inicio === mondayStr);
      if (existingPlan) {
        await loadPlan(existingPlan.id, existingPlan.nome);
        setSugestaoGerada(true);
      } else {
        setPlanoId(null);
        setPlanoNome("Plano Semanal");
        const suggested = gerarSugestao(saboresData, estoqueMap, md, gplMap, vpd);
        setItens(suggested);
        setSugestaoGerada(true);
      }
    } catch (e: any) {
      toast({ title: "Erro ao carregar dados", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function gerarSugestao(
    saboresData: any[], estoqueMap: Record<string, number>,
    md: Record<string, number>, gplMap: Record<string, number>,
    vpd: Record<number, Record<string, number>>
  ): PlanItem[] {
    const items: PlanItem[] = [];
    const diasProducao = [1, 2, 3, 4, 5];
    const sorted = [...saboresData].sort((a, b) => {
      const aPri = PRIORIDADE_SABORES.findIndex(p => a.nome.toLowerCase().includes(p));
      const bPri = PRIORIDADE_SABORES.findIndex(p => b.nome.toLowerCase().includes(p));
      const aIdx = aPri >= 0 ? aPri : 99;
      const bIdx = bPri >= 0 ? bPri : 99;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (md[b.id] || 0) - (md[a.id] || 0);
    });
    sorted.forEach(sabor => {
      const media = md[sabor.id] || 0;
      if (media === 0 && (estoqueMap[sabor.id] || 0) > 50) return;
      const estoqueAtual = estoqueMap[sabor.id] || 0;
      const demandaSemanal = media * 7;
      const deficit = Math.max(0, demandaSemanal - estoqueAtual);
      if (deficit <= 0 && estoqueAtual > demandaSemanal * 1.5) return;
      const gpl = gplMap[sabor.id] || 84;
      const lotesNecessarios = Math.max(1, Math.ceil(deficit / gpl));
      const unidadesTotal = lotesNecessarios * gpl;
      if (unidadesTotal === 0) return;
      const diasComVendas = diasProducao
        .map(d => ({ dia: d, vendas: vpd[d]?.[sabor.id] || 0 }))
        .sort((a, b) => b.vendas - a.vendas);
      const numDias = lotesNecessarios <= 1 ? 1 : Math.min(3, lotesNecessarios);
      const lotesPorDia = Math.ceil(lotesNecessarios / numDias);
      let lotesRestantes = lotesNecessarios;
      for (let i = 0; i < numDias && lotesRestantes > 0; i++) {
        const lotes = Math.min(lotesPorDia, lotesRestantes);
        items.push({
          id: crypto.randomUUID(), sabor_id: sabor.id,
          dia_semana: diasComVendas[i % diasComVendas.length].dia,
          quantidade: lotes * gpl,
        });
        lotesRestantes -= lotes;
      }
    });
    return items;
  }

  async function loadPlan(id: string, nome: string) {
    setPlanoId(id);
    setPlanoNome(nome);
    const { data } = await (supabase as any).from("plano_semanal_itens").select("*").eq("plano_id", id);
    setItens((data || []).map((d: any) => ({
      id: d.id, sabor_id: d.sabor_id, dia_semana: d.dia_semana, quantidade: d.quantidade,
    })));
  }

  function addItem(dia: number) {
    if (sabores.length === 0) return;
    setItens(prev => [...prev, {
      id: crypto.randomUUID(), sabor_id: sabores[0].id, dia_semana: dia, quantidade: gelosPorLote[sabores[0].id] || 84, editing: true,
    }]);
  }

  function removeItem(id: string) { setItens(prev => prev.filter(i => i.id !== id)); }

  function updateItem(id: string, field: keyof PlanItem, value: any) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function toggleEditing(id: string) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, editing: !i.editing } : i));
  }

  function regenerarSugestao() {
    const suggested = gerarSugestao(sabores, estoque, mediaDiaria, gelosPorLote, vendasPorDia);
    setItens(suggested);
    setPlanoId(null);
    setAiAtivo(false);
    setAiResumo(null);
    setAiJustificativas({});
    toast({ title: "Sugestão regenerada! ✨" });
  }

  async function consultarIA() {
    setAiLoading(true);
    setAiResumo(null);
    setAiJustificativas({});
    try {
      const saboresPayload = sabores.map(s => ({
        id: s.id,
        nome: s.nome,
        estoqueAtual: estoque[s.id] || 0,
        vendas7d: vendas7d[s.id] || 0,
        mediaDiaria: mediaDiaria[s.id] || 0,
        gelosPorLote: gelosPorLote[s.id] || 84,
      }));

      const { data, error } = await supabase.functions.invoke("suggest-producao-semanal", {
        body: { sabores_analise: saboresPayload, factory_id: factoryId },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro da IA", description: data.error, variant: "destructive" });
        return;
      }

      const plano: any[] = data?.plano || [];
      setAiResumo(data?.resumo || null);
      setAiAtivo(true);

      // Convert AI plan to PlanItems
      const newItens: PlanItem[] = [];
      const justMap: Record<string, Record<number, { confianca: string; justificativa: string }>> = {};

      plano.forEach((item: any) => {
        if (item.lotes <= 0) return;
        const sabor = sabores.find(s => 
          s.nome.toLowerCase() === item.sabor_nome?.toLowerCase() ||
          s.nome.toLowerCase().includes(item.sabor_nome?.toLowerCase() || "___")
        );
        if (!sabor) return;
        const gpl = gelosPorLote[sabor.id] || 84;
        newItens.push({
          id: crypto.randomUUID(),
          sabor_id: sabor.id,
          dia_semana: item.dia_semana,
          quantidade: item.lotes * gpl,
        });
        if (!justMap[sabor.id]) justMap[sabor.id] = {};
        justMap[sabor.id][item.dia_semana] = {
          confianca: item.confianca || "media",
          justificativa: item.justificativa || "",
        };
      });

      setItens(newItens);
      setAiJustificativas(justMap);
      setPlanoId(null);

      toast({ title: "🤖 Plano semanal da IA aplicado!", description: data?.resumo });
    } catch (e: any) {
      console.error("Erro ao consultar IA:", e);
      toast({ title: "Erro ao consultar IA", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  const totalPorSabor = useMemo(() => {
    const map: Record<string, number> = {};
    itens.forEach(i => { map[i.sabor_id] = (map[i.sabor_id] || 0) + i.quantidade; });
    return map;
  }, [itens]);

  const totalGeral = useMemo(() => itens.reduce((s, i) => s + i.quantidade, 0), [itens]);

  const totalLotes = useMemo(() => {
    let lotes = 0;
    itens.forEach(i => {
      const gpl = gelosPorLote[i.sabor_id] || 84;
      lotes += Math.round(i.quantidade / gpl);
    });
    return lotes;
  }, [itens, gelosPorLote]);

  const estoqueProjetado = useMemo(() => {
    const map: Record<string, number> = {};
    sabores.forEach(s => {
      const atual = estoque[s.id] || 0;
      const prod = totalPorSabor[s.id] || 0;
      const vendasProjetadas = (mediaDiaria[s.id] || 0) * 7;
      map[s.id] = atual + prod - vendasProjetadas;
    });
    return map;
  }, [sabores, estoque, totalPorSabor, mediaDiaria]);

  const itensPorDia = useMemo(() => {
    const map: Record<number, PlanItem[]> = {};
    DIAS_SEMANA.forEach(d => { map[d.value] = []; });
    itens.forEach(i => {
      if (!map[i.dia_semana]) map[i.dia_semana] = [];
      map[i.dia_semana].push(i);
    });
    return map;
  }, [itens]);

  const saboresUnicos = useMemo(() => new Set(itens.map(i => i.sabor_id)).size, [itens]);
  const diasComProducao = DIAS_SEMANA.filter(d => (itensPorDia[d.value] || []).length > 0).length;

  async function salvarPlano() {
    setSaving(true);
    try {
      const mondayStr = mondayOfWeek.toISOString().slice(0, 10);
      let currentPlanoId = planoId;
      if (!currentPlanoId) {
        const { data, error } = await (supabase as any).from("planos_semanais").insert({
          factory_id: factoryId, nome: planoNome, semana_inicio: mondayStr, status: "rascunho",
        }).select().single();
        if (error) throw error;
        currentPlanoId = data.id;
        setPlanoId(data.id);
      } else {
        await (supabase as any).from("planos_semanais").update({ nome: planoNome }).eq("id", currentPlanoId);
        await (supabase as any).from("plano_semanal_itens").delete().eq("plano_id", currentPlanoId);
      }
      if (itens.length > 0) {
        const rows = itens.map(i => ({
          plano_id: currentPlanoId, factory_id: factoryId,
          sabor_id: i.sabor_id, dia_semana: i.dia_semana, quantidade: i.quantidade,
        }));
        const { error } = await (supabase as any).from("plano_semanal_itens").insert(rows);
        if (error) throw error;
      }
      toast({ title: "Plano salvo com sucesso! ✅" });
      setShowSaveDialog(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deletarPlano() {
    if (!deleteConfirm) return;
    try {
      await (supabase as any).from("planos_semanais").delete().eq("id", deleteConfirm);
      toast({ title: "Plano excluído!" });
      setDeleteConfirm(null);
      if (deleteConfirm === planoId) { setPlanoId(null); setItens([]); }
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function duplicarPlano() {
    setWeekOffset(prev => prev + 1);
    setTimeout(() => { setPlanoId(null); setPlanoNome("Plano Semanal (cópia)"); }, 100);
    toast({ title: "Plano copiado para a próxima semana" });
  }

  function getSaborNome(id: string): string {
    return sabores.find(s => s.id === id)?.nome || "—";
  }

  function getStatusInfo(projetado: number, media: number) {
    if (media === 0) return null;
    const cobertura = projetado / media;
    if (cobertura > 14) return { label: "Excesso", icon: AlertTriangle, className: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    if (cobertura < 3) return { label: "Risco", icon: TrendingDown, className: "text-red-500 bg-red-500/10 border-red-500/20" };
    return { label: "OK", icon: CheckCircle2, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/painel/plano-producao")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Plano Semanal
            </h1>
            <p className="text-sm text-muted-foreground">Planeje a produção da semana</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setWeekOffset(prev => prev - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-sm px-4 py-1.5 font-medium">{semanaLabel}</Badge>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setWeekOffset(prev => prev + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {itens.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sabores", value: saboresUnicos, icon: "🍧", color: "from-violet-500/10 to-purple-500/10" },
            { label: "Lotes", value: totalLotes, icon: "📦", color: "from-blue-500/10 to-cyan-500/10" },
            { label: "Unidades", value: totalGeral.toLocaleString("pt-BR"), icon: "❄️", color: "from-emerald-500/10 to-teal-500/10" },
            { label: "Dias", value: diasComProducao, icon: "📅", color: "from-amber-500/10 to-orange-500/10" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`bg-gradient-to-br ${stat.color} border-border/40`}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <div>
                    <p className="text-xl font-bold leading-none">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Estoque Projetado Bar - like the stock summary from Estoque page */}
      <Card className="bg-gradient-to-r from-rose-500/5 to-orange-500/5 border-border/40">
        <CardContent className="py-3 px-4">
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            ❄️ ESTOQUE PROJETADO (ATUAL + PLANO − VENDAS 7D)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sabores
              .map(s => ({
                id: s.id,
                nome: s.nome,
                atual: estoque[s.id] || 0,
                prodPlano: totalPorSabor[s.id] || 0,
                projetado: estoqueProjetado[s.id] || 0,
              }))
              .sort((a, b) => b.projetado - a.projetado)
              .map(s => {
                const color = getSaborColor(s.nome);
                const isZero = s.projetado <= 0;
                const isLow = s.projetado > 0 && s.projetado < 50;
                return (
                  <TooltipProvider key={s.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold gap-1 px-2 py-0.5 cursor-default transition-all ${
                            isZero ? "opacity-50 border-red-500/30 bg-red-500/5" : 
                            isLow ? "border-amber-500/30 bg-amber-500/5" : 
                            "border-border/50"
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate max-w-[80px]">{s.nome}</span>
                          <span className={`font-bold ${isZero ? "text-red-500" : isLow ? "text-amber-500" : ""}`}>
                            {s.projetado}
                          </span>
                          {s.prodPlano > 0 && (
                            <span className="text-emerald-500 text-[10px]">+{s.prodPlano}</span>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p><strong>{s.nome}</strong></p>
                        <p>Estoque atual: {s.atual}</p>
                        <p>+ Produção plano: {s.prodPlano}</p>
                        <p>− Vendas projetadas (7d): {(mediaDiaria[s.id] || 0) * 7}</p>
                        <p className="font-bold mt-1">= Projetado: {s.projetado}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-3">
              TOTAL {Object.values(estoqueProjetado).reduce((s, v) => s + Math.max(0, v), 0)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" className="rounded-full" onClick={regenerarSugestao}>
          <Sparkles className="h-4 w-4 mr-1.5" /> Sugestão Automática
        </Button>
        <Button
          size="sm"
          className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
          onClick={consultarIA}
          disabled={aiLoading || sabores.length === 0}
        >
          {aiLoading ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Consultando IA...</>
          ) : (
            <><Brain className="h-4 w-4 mr-1.5" /> Sugestão com IA</>
          )}
        </Button>
        {aiAtivo && (
          <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20 gap-1">
            <Bot className="h-3 w-3" /> IA ativa
          </Badge>
        )}
      </div>

      {/* AI Resume */}
      {aiResumo && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-r from-violet-500/5 to-purple-500/5 border-violet-500/20">
            <CardContent className="py-3 px-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-violet-600 mb-0.5">Análise da IA</p>
                <p className="text-sm text-foreground">{aiResumo}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Weekly grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {DIAS_SEMANA.map((dia, idx) => {
          const diaItens = itensPorDia[dia.value] || [];
          const totalDia = diaItens.reduce((s, i) => s + i.quantidade, 0);
          const lotesDia = diaItens.reduce((s, i) => s + Math.round(i.quantidade / (gelosPorLote[i.sabor_id] || 84)), 0);
          const diaDate = new Date(mondayOfWeek);
          const offset = dia.value === 0 ? 6 : dia.value - 1;
          diaDate.setDate(mondayOfWeek.getDate() + offset);
          const isEmpty = diaItens.length === 0;

          return (
            <motion.div key={dia.value} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <Card className={`overflow-hidden transition-shadow hover:shadow-md bg-gradient-to-b ${dia.gradient} ${isEmpty ? "border-dashed border-border/50" : dia.border}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-4 pt-3 pb-1 ${dia.headerBg} rounded-t-lg`}>
                  <div>
                    <h3 className="font-bold text-base">{dia.label}</h3>
                    {!isEmpty && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lotesDia} lote(s) · <span className="font-semibold text-foreground">{totalDia} un</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isEmpty && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-destructive/10"
                        onClick={() => setItens(prev => prev.filter(i => i.dia_semana !== dia.value))}
                        title="Limpar dia">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground font-medium">
                      {diaDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="px-3 pb-3 pt-1 space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {diaItens.map(item => {
                      const nome = getSaborNome(item.sabor_id);
                      const color = getSaborColor(nome);
                      const gpl = gelosPorLote[item.sabor_id] || 84;
                      const lotes = Math.round(item.quantidade / gpl);

                      if (item.editing) {
                        return (
                          <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="rounded-xl p-2.5 border-2 border-primary/40 bg-primary/5 space-y-2">
                            <Select value={item.sabor_id} onValueChange={v => updateItem(item.id, "sabor_id", v)}>
                              <SelectTrigger className="h-8 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {sabores.map(s => (
                                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Input type="number" min={0} value={item.quantidade}
                                onChange={e => updateItem(item.id, "quantidade", parseInt(e.target.value) || 0)}
                                className="h-8 text-xs text-center flex-1 rounded-lg" />
                              <span className="text-[10px] text-muted-foreground">un</span>
                              <Button variant="default" size="icon" className="h-7 w-7 rounded-full" onClick={() => toggleEditing(item.id)}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="destructive" size="icon" className="h-7 w-7 rounded-full" onClick={() => removeItem(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      }

                      const aiInfo = aiJustificativas[item.sabor_id]?.[item.dia_semana];

                      return (
                        <motion.div key={item.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 group hover:bg-muted/60 transition-all cursor-default ${aiInfo ? "bg-violet-500/5 border border-violet-500/10" : "bg-muted/40"}`}>
                          <div className="h-3 w-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}40` }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold truncate leading-tight">{nome}</p>
                              {aiInfo && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                        aiInfo.confianca === "alta" ? "bg-emerald-500/10 text-emerald-600" :
                                        aiInfo.confianca === "media" ? "bg-amber-500/10 text-amber-600" :
                                        "bg-red-500/10 text-red-500"
                                      }`}>
                                        <Bot className="h-2.5 w-2.5" />
                                        {aiInfo.confianca === "alta" ? "🟢" : aiInfo.confianca === "media" ? "🟡" : "🔴"}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px]">
                                      <p className="text-xs font-medium">{aiInfo.justificativa}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">Confiança: {aiInfo.confianca}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{lotes} lote(s) · {item.quantidade} un</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/10" onClick={() => toggleEditing(item.id)}>
                              <Pencil className="h-3 w-3 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-destructive/10" onClick={() => removeItem(item.id)}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  <Button variant="ghost" size="sm" className="w-full h-8 text-xs rounded-xl border border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors mt-1"
                    onClick={() => addItem(dia.value)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Stock projection */}
      {itens.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-base">Projeção de Estoque</h3>
            </div>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Sabor</th>
                      <th className="text-center py-2.5 px-2 font-medium text-muted-foreground text-xs">Estoque</th>
                      <th className="text-center py-2.5 px-2 font-medium text-muted-foreground text-xs">+ Produção</th>
                      <th className="text-center py-2.5 px-2 font-medium text-muted-foreground text-xs">- Vendas</th>
                      <th className="text-center py-2.5 px-2 font-medium text-muted-foreground text-xs">= Projetado</th>
                      <th className="text-center py-2.5 px-2 font-medium text-muted-foreground text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totalPorSabor)
                      .sort(([, a], [, b]) => b - a)
                      .map(([saborId, total]) => {
                        const nome = getSaborNome(saborId);
                        const color = getSaborColor(nome);
                        const estoqueAtual = estoque[saborId] || 0;
                        const proj = estoqueProjetado[saborId] || 0;
                        const media = mediaDiaria[saborId] || 0;
                        const vendasProj = media * 7;
                        const status = getStatusInfo(proj, media);

                        return (
                          <tr key={saborId} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="font-medium text-sm">{nome}</span>
                              </div>
                            </td>
                            <td className="text-center py-2.5 px-2 text-muted-foreground tabular-nums">{estoqueAtual}</td>
                            <td className="text-center py-2.5 px-2 tabular-nums"><span className="text-emerald-600 font-semibold">+{total}</span></td>
                            <td className="text-center py-2.5 px-2 tabular-nums"><span className="text-red-500 font-medium">-{Math.round(vendasProj)}</span></td>
                            <td className="text-center py-2.5 px-2 tabular-nums">
                              <span className={`font-bold ${proj < 0 ? "text-red-600" : "text-foreground"}`}>{Math.round(proj)}</span>
                            </td>
                            <td className="text-center py-2.5 px-2">
                              {status && (
                                <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                                  <status.icon className="h-3 w-3 mr-0.5" />{status.label}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Saved plans */}
      {planosExistentes.length > 0 && (
        <Card>
          <div className="px-4 pt-4 pb-2">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Planos Salvos</h3>
          </div>
          <CardContent className="space-y-2 pt-0">
            {planosExistentes.map(p => (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${p.id === planoId ? "border-primary/50 bg-primary/5" : "border-border/40 hover:bg-muted/30"}`}>
                <div>
                  <p className="text-sm font-semibold">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.semana_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                    {" · "}<Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => {
                    const mon = new Date(p.semana_inicio + "T00:00:00");
                    const currentMon = getMonday(new Date());
                    const diff = Math.round((mon.getTime() - currentMon.getTime()) / (7 * 24 * 60 * 60 * 1000));
                    setWeekOffset(diff);
                  }}>Carregar</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-destructive/10" onClick={() => setDeleteConfirm(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Floating action bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-xl px-4 py-2.5">
          <Button variant="outline" size="sm" className="rounded-full" onClick={duplicarPlano} disabled={itens.length === 0}>
            <Copy className="h-4 w-4 mr-1.5" /> Duplicar
          </Button>
          <Button size="sm" className="rounded-full shadow-sm" onClick={() => setShowSaveDialog(true)} disabled={itens.length === 0}>
            <Save className="h-4 w-4 mr-1.5" /> Salvar Plano
          </Button>
        </motion.div>
      </div>

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Salvar Plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do plano</Label>
              <Input value={planoNome} onChange={e => setPlanoNome(e.target.value)} className="mt-1" />
            </div>
            <p className="text-sm text-muted-foreground">
              Semana: {semanaLabel} · {totalGeral} un · {saboresUnicos} sabores
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancelar</Button>
            <Button onClick={salvarPlano} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deletarPlano}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
