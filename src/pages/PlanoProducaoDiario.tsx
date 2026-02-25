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
  AlertTriangle, CheckCircle2, Snowflake, BarChart3, Check, X
} from "lucide-react";

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

// Escala fixa: Terça/Quarta = Aghata + Maria, Quinta/Sexta = Jhulia + Aghata
const ESCALA_PRODUCAO: Record<number, string[]> = {
  2: ["aghata", "maria"],   // terça
  3: ["aghata", "maria"],   // quarta
  4: ["jhulia", "aghata"],  // quinta
  5: ["jhulia", "aghata"],  // sexta
};
const NOMES_DIA: Record<number, string> = {
  0: "Domingo", 1: "Segunda-feira", 2: "Terça-feira",
  3: "Quarta-feira", 4: "Quinta-feira", 5: "Sexta-feira", 6: "Sábado",
};

export default function PlanoProducaoDiario() {
  const [analises, setAnalises] = useState<SaborAnalise[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [funcSelecionados, setFuncSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [executado, setExecutado] = useState(false);

  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const diaProducao = diaSemana >= 2 && diaSemana <= 5;
  const escalaDoDia = ESCALA_PRODUCAO[diaSemana] || [];

  useEffect(() => { calcular(); }, []);

  async function calcular() {
    setLoading(true);
    setExecutado(false);
    try {
      const [vendasRes, gelosRes, saboresRes, funcsRes] = await Promise.all([
        (supabase as any).from("venda_itens").select("sabor_id, quantidade, vendas!inner(created_at, status)"),
        (supabase as any).from("estoque_gelos").select("quantidade, sabor_id, sabores(nome, id)"),
        (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome"),
        (supabase as any).from("funcionarios").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      const funcs = funcsRes.data || [];
      setFuncionarios(funcs);

      // Auto-selecionar funcionários da escala do dia
      if (escalaDoDia.length > 0) {
        const ids = escalaDoDia
          .map(nome => funcs.find((f: any) => f.nome.toLowerCase().includes(nome)))
          .filter(Boolean)
          .map((f: any) => f.id);
        if (ids.length > 0) setFuncSelecionados(ids);
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
          selecionado: prioritario ? true : loteSugerido > 0,
          lotesCustom: prioritario ? Math.max(1, loteSugerido || 1) : loteSugerido,
          prioritario,
          ordemPrioridade: prioritario ? idx : 999,
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
      for (const item of itens) {
        await realizarProducao({
          p_sabor_id: item.id,
          p_modo: "lote",
          p_quantidade_lotes: item.lotesCustom,
          p_quantidade_total: item.lotesCustom * 84,
          p_operador: nomesFuncionarios || "sistema",
          p_observacoes: `Produção autorizada conforme estratégia de reposição por giro de vendas.`,
          p_funcionarios: validFuncs.map(f => ({ funcionario_id: f, quantidade_produzida: 0 })),
        });
      }

      const totalLotes = itens.reduce((s, i) => s + i.lotesCustom, 0);
      const totalUnidades = totalLotes * 84;
      toast({
        title: "✅ Produção autorizada!",
        description: `${itens.length} sabor(es) · ${totalLotes} lote(s) · ${totalUnidades.toLocaleString()} unidades`,
      });
      setExecutado(true);
      calcular();
    } catch (e: any) {
      toast({ title: "Erro na produção", description: e.message, variant: "destructive" });
    } finally {
      setExecutando(false);
    }
  }

  const selecionados = analises.filter(a => a.selecionado && a.lotesCustom > 0);
  const totalLotes = selecionados.reduce((s, a) => s + a.lotesCustom, 0);
  const totalUnidades = totalLotes * 84;
  const progressTotal = analises.length > 0 ? Math.round((selecionados.length / analises.length) * 100) : 0;

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
              {NOMES_DIA[diaSemana]} · {selecionados.length} de {analises.length} sabores · {totalLotes} lotes · {totalUnidades.toLocaleString()} un
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={calcular} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </div>

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
              Escala de Hoje — {NOMES_DIA[diaSemana]}
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
        {analises.map((a, index) => {
          const color = getSaborColor(a.nome);
          const isSelected = a.selecionado && a.lotesCustom > 0;
          const coberturaPercent = Math.min(100, (a.diasCobertura / 14) * 100);

          return (
            <Card
              key={a.id}
              className={`transition-all duration-300 cursor-pointer overflow-hidden ${
                isSelected
                  ? "ring-1 ring-primary/30 shadow-md"
                  : "hover:shadow-sm"
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
                      isSelected
                        ? "scale-110"
                        : "bg-muted"
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
                  <Snowflake className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold">
                  {selecionados.length} sabor(es)
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalLotes} lotes · {totalUnidades.toLocaleString()} un
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
