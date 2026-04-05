import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays, Plus, Trash2, Save, ArrowLeft, Pencil,
  TrendingDown, AlertTriangle, CheckCircle2,
  Copy, BarChart3, Sparkles, Snowflake, Package, X, Check
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const DIAS_SEMANA = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
];

const PRIORIDADE_SABORES = ["melancia", "maçã verde", "morango", "maracujá", "água de coco"];

const SABOR_COLORS: Record<string, string> = {
  melancia: "#ef4444", "maçã verde": "#22c55e", morango: "#f43f5e",
  maracujá: "#f59e0b", "água de coco": "#06b6d4", "bob marley": "#a3e635",
  abacaxi: "#eab308", limão: "#84cc16", pitaya: "#d946ef", "blue ice": "#3b82f6",
};

function getSaborColor(nome: string): string {
  const lower = nome.toLowerCase();
  for (const [key, color] of Object.entries(SABOR_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#8b5cf6";
}

function ProgressRing({ progress, color, size = 48 }: { progress: number; color: string; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out" />
    </svg>
  );
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

      // Gelos por lote map
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
        // Auto-suggest
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
    saboresData: any[],
    estoqueMap: Record<string, number>,
    md: Record<string, number>,
    gplMap: Record<string, number>,
    vpd: Record<number, Record<string, number>>
  ): PlanItem[] {
    const items: PlanItem[] = [];
    // Production days: Mon-Fri (1-5)
    const diasProducao = [1, 2, 3, 4, 5];

    // Sort sabores: priority first, then by demand
    const sorted = [...saboresData].sort((a, b) => {
      const aPri = PRIORIDADE_SABORES.findIndex(p => a.nome.toLowerCase().includes(p));
      const bPri = PRIORIDADE_SABORES.findIndex(p => b.nome.toLowerCase().includes(p));
      const aIdx = aPri >= 0 ? aPri : 99;
      const bIdx = bPri >= 0 ? bPri : 99;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (md[b.id] || 0) - (md[a.id] || 0);
    });

    // For each sabor with demand, distribute across days
    sorted.forEach(sabor => {
      const media = md[sabor.id] || 0;
      if (media === 0 && (estoqueMap[sabor.id] || 0) > 50) return; // Skip low-demand with high stock

      const estoqueAtual = estoqueMap[sabor.id] || 0;
      const demandaSemanal = media * 7;
      const deficit = Math.max(0, demandaSemanal - estoqueAtual);

      if (deficit <= 0 && estoqueAtual > demandaSemanal * 1.5) return; // Plenty of stock

      const gpl = gplMap[sabor.id] || 84;
      const lotesNecessarios = Math.max(1, Math.ceil(deficit / gpl));
      const unidadesTotal = lotesNecessarios * gpl;

      if (unidadesTotal === 0) return;

      // Find best days based on day-of-week sales pattern
      const diasComVendas = diasProducao
        .map(d => ({ dia: d, vendas: vpd[d]?.[sabor.id] || 0 }))
        .sort((a, b) => b.vendas - a.vendas);

      // Distribute across 1-3 days depending on volume
      const numDias = lotesNecessarios <= 1 ? 1 : Math.min(3, lotesNecessarios);
      const lotesPorDia = Math.ceil(lotesNecessarios / numDias);

      let lotesRestantes = lotesNecessarios;
      for (let i = 0; i < numDias && lotesRestantes > 0; i++) {
        const lotes = Math.min(lotesPorDia, lotesRestantes);
        items.push({
          id: crypto.randomUUID(),
          sabor_id: sabor.id,
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
      id: crypto.randomUUID(), sabor_id: sabores[0].id, dia_semana: dia, quantidade: 84, editing: true,
    }]);
  }

  function removeItem(id: string) {
    setItens(prev => prev.filter(i => i.id !== id));
  }

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
    toast({ title: "Sugestão regenerada! ✨" });
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

  function getStatusBadge(projetado: number, media: number) {
    if (media === 0) return null;
    const cobertura = projetado / media;
    if (cobertura > 14) return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Excesso</Badge>;
    if (cobertura < 3) return <Badge variant="outline" className="bg-red-500/10 text-red-600 text-[10px]"><TrendingDown className="h-3 w-3 mr-1" />Risco</Badge>;
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/painel/plano-producao")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Plano Semanal
            </h1>
            <p className="text-sm text-muted-foreground">Sugestão automática de produção por dia</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(prev => prev - 1)}>← Anterior</Button>
          <Badge variant="secondary" className="text-sm px-3 py-1">{semanaLabel}</Badge>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(prev => prev + 1)}>Próxima →</Button>
        </div>
      </div>

      {/* Summary card with progress ring - like the reference image */}
      {itens.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Card className="flex-1 min-w-[180px]">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="relative">
                <ProgressRing progress={Math.min(100, (saboresUnicos / Math.max(1, sabores.length)) * 100)} color="hsl(var(--primary))" size={48} />
                <Snowflake className="h-4 w-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <p className="text-lg font-bold">{saboresUnicos} sabor(es)</p>
                <p className="text-xs text-muted-foreground">{totalLotes} lotes · {totalGeral} un</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{totalGeral}</p>
                <p className="text-xs text-muted-foreground">Unidades totais</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{DIAS_SEMANA.filter(d => (itensPorDia[d.value] || []).length > 0).length}</p>
                <p className="text-xs text-muted-foreground">Dias com produção</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Regenerate button */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={regenerarSugestao}>
          <Sparkles className="h-4 w-4 mr-1" /> Regenerar Sugestão
        </Button>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {DIAS_SEMANA.map(dia => {
          const diaItens = itensPorDia[dia.value] || [];
          const totalDia = diaItens.reduce((s, i) => s + i.quantidade, 0);
          const lotesDia = diaItens.reduce((s, i) => s + Math.round(i.quantidade / (gelosPorLote[i.sabor_id] || 84)), 0);
          const diaDate = new Date(mondayOfWeek);
          const offset = dia.value === 0 ? 6 : dia.value - 1;
          diaDate.setDate(mondayOfWeek.getDate() + offset);

          return (
            <Card key={dia.value} className="border-border/50 overflow-hidden">
              <CardHeader className="pb-1 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{dia.label}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {diaDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
                {totalDia > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{lotesDia} lote(s)</span>
                    <span>·</span>
                    <span className="font-medium text-foreground">{totalDia} un</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5">
                {diaItens.map(item => {
                  const nome = getSaborNome(item.sabor_id);
                  const color = getSaborColor(nome);
                  const gpl = gelosPorLote[item.sabor_id] || 84;
                  const lotes = Math.round(item.quantidade / gpl);

                  if (item.editing) {
                    return (
                      <div key={item.id} className="rounded-lg p-2 border border-primary/30 bg-primary/5 space-y-1.5">
                        <Select value={item.sabor_id} onValueChange={v => updateItem(item.id, "sabor_id", v)}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sabores.map(s => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number" min={0} value={item.quantidade}
                            onChange={e => updateItem(item.id, "quantidade", parseInt(e.target.value) || 0)}
                            className="h-7 text-xs text-center flex-1"
                          />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">un</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleEditing(item.id)}>
                            <Check className="h-3 w-3 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg p-1.5 bg-muted/30 group hover:bg-muted/50 transition-colors">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{nome}</p>
                        <p className="text-[10px] text-muted-foreground">{lotes} lote(s) · {item.quantidade} un</p>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleEditing(item.id)}>
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeItem(item.id)}>
                          <X className="h-2.5 w-2.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => addItem(dia.value)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumo / Projeção */}
      {itens.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Projeção de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Sabor</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">Estoque</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">+Produção</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">-Vendas (proj.)</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">= Projetado</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totalPorSabor)
                    .sort(([, a], [, b]) => b - a)
                    .map(([saborId, total]) => {
                      const nome = getSaborNome(saborId);
                      const estoqueAtual = estoque[saborId] || 0;
                      const proj = estoqueProjetado[saborId] || 0;
                      const media = mediaDiaria[saborId] || 0;
                      const vendasProj = media * 7;

                      return (
                        <tr key={saborId} className="border-b border-border/30">
                          <td className="py-2 px-2 flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getSaborColor(nome) }} />
                            <span className="font-medium truncate">{nome}</span>
                          </td>
                          <td className="text-center py-2 px-1 text-muted-foreground">{estoqueAtual}</td>
                          <td className="text-center py-2 px-1"><span className="text-emerald-600 font-medium">+{total}</span></td>
                          <td className="text-center py-2 px-1"><span className="text-red-500">-{Math.round(vendasProj)}</span></td>
                          <td className="text-center py-2 px-1">
                            <span className={`font-bold ${proj < 0 ? "text-red-600" : "text-foreground"}`}>{Math.round(proj)}</span>
                          </td>
                          <td className="text-center py-2 px-1">{getStatusBadge(proj, media)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planos salvos */}
      {planosExistentes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Planos Salvos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planosExistentes.map(p => (
              <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border ${p.id === planoId ? "border-primary bg-primary/5" : "border-border/50"}`}>
                <div>
                  <p className="text-sm font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Semana: {new Date(p.semana_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                    {" · "}<Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    const mon = new Date(p.semana_inicio + "T00:00:00");
                    const currentMon = getMonday(new Date());
                    const diff = Math.round((mon.getTime() - currentMon.getTime()) / (7 * 24 * 60 * 60 * 1000));
                    setWeekOffset(diff);
                  }}>Carregar</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(p.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Floating bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border rounded-xl shadow-lg px-4 py-2">
        <Button variant="outline" size="sm" onClick={duplicarPlano} disabled={itens.length === 0}>
          <Copy className="h-4 w-4 mr-1" /> Duplicar
        </Button>
        <Button size="sm" onClick={() => setShowSaveDialog(true)} disabled={itens.length === 0}>
          <Save className="h-4 w-4 mr-1" /> Salvar Plano
        </Button>
      </div>

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Salvar Plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do plano</Label>
              <Input value={planoNome} onChange={e => setPlanoNome(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Semana: {semanaLabel} · {totalGeral} unidades · {saboresUnicos} sabores
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
