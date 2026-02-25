import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realizarProducao } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Factory, TrendingUp, TrendingDown, Minus, PackageCheck, RefreshCw,
  AlertTriangle, CheckCircle2, Snowflake, BarChart3
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
}

export default function PlanoProducaoDiario() {
  const [analises, setAnalises] = useState<SaborAnalise[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [funcSelecionados, setFuncSelecionados] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [executado, setExecutado] = useState(false);

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

      setFuncionarios(funcsRes.data || []);

      const vendaItens = (vendasRes.data || []).filter((v: any) => v.vendas?.status !== "cancelada");
      const gelos = gelosRes.data || [];
      const saboresAtivos = saboresRes.data || [];

      const agora = new Date();
      const seteDias = new Date(agora); seteDias.setDate(seteDias.getDate() - 7);
      const trintaDias = new Date(agora); trintaDias.setDate(trintaDias.getDate() - 30);

      // Agrupar vendas por sabor
      const vendaMap: Record<string, { v7d: number; v30d: number }> = {};
      vendaItens.forEach((item: any) => {
        const id = item.sabor_id;
        if (!vendaMap[id]) vendaMap[id] = { v7d: 0, v30d: 0 };
        const dt = new Date(item.vendas?.created_at);
        if (dt >= seteDias) vendaMap[id].v7d += item.quantidade;
        if (dt >= trintaDias) vendaMap[id].v30d += item.quantidade;
      });

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

        // Sugerir lotes: cobrir 7 dias de demanda
        const necessario7d = Math.ceil(mediaDiaria7d * 7);
        const deficit = Math.max(0, necessario7d - estoqueAtual);
        const loteSugerido = Math.ceil(deficit / 84);

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
          selecionado: loteSugerido > 0,
          lotesCustom: loteSugerido,
        };
      });

      // Prioridade fixa diária: 5 lotes distribuídos nesta ordem
      const prioridadeDiaria = [
        "melancia",
        "maçã verde",
        "morango",
        "maracujá",
        "água de coco",
      ];

      // Aplicar prioridade fixa: sabores prioritários sempre selecionados com 1 lote cada
      result.forEach(r => {
        const idx = prioridadeDiaria.findIndex(p => r.nome.toLowerCase().includes(p));
        if (idx !== -1) {
          r.selecionado = true;
          r.lotesCustom = Math.max(1, r.loteSugerido || 1);
        }
      });

      // Ordenar: prioritários primeiro (na ordem definida), depois por cobertura
      result.sort((a, b) => {
        const idxA = prioridadeDiaria.findIndex(p => a.nome.toLowerCase().includes(p));
        const idxB = prioridadeDiaria.findIndex(p => b.nome.toLowerCase().includes(p));
        if (idxA !== -1 && idxB === -1) return -1;
        if (idxA === -1 && idxB !== -1) return 1;
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
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

  const tendenciaIcon = (t: string) => {
    if (t === "alta") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (t === "baixa") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Factory className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Plano de Produção Diário</h1>
            <p className="text-xs text-muted-foreground">
              Análise automática de estoque e vendas · Reposição inteligente por giro
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={calcular} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </div>

      {/* Resumo do plano */}
      {selecionados.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <PackageCheck className="h-5 w-5 text-primary" />
              <span className="font-bold text-sm">Resumo da Produção Autorizada</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {selecionados.map(s => (
                <Badge key={s.id} variant="secondary" className="text-xs font-semibold">
                  {s.nome}: {s.lotesCustom} lote(s) = {s.lotesCustom * 84} un
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-primary text-lg">{totalLotes} lotes · {totalUnidades.toLocaleString()} unidades</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Responsáveis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Responsável(is) pela Produção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funcSelecionados.map((fId, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={fId} onValueChange={(v) => updateFunc(i, v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {funcionarios.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {funcSelecionados.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeFunc(i)} className="text-destructive">✕</Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addFunc}>+ Adicionar responsável</Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid de sabores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analises.map(a => (
          <Card
            key={a.id}
            className={`transition-all ${
              a.selecionado && a.lotesCustom > 0
                ? "border-primary/50 ring-1 ring-primary/20 bg-primary/[0.02]"
                : a.diasCobertura <= 3
                  ? "border-destructive/40"
                  : a.diasCobertura <= 7
                    ? "border-amber-500/40"
                    : ""
            }`}
          >
            <CardContent className="pt-4 space-y-3">
              {/* Header do card */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={a.selecionado}
                    onCheckedChange={() => toggleSabor(a.id)}
                    id={`chk-${a.id}`}
                  />
                  <label htmlFor={`chk-${a.id}`} className="font-bold text-sm cursor-pointer">
                    {a.nome}
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  {tendenciaIcon(a.tendencia)}
                  <Badge
                    variant={a.tendencia === "alta" ? "default" : a.tendencia === "baixa" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {a.tendencia}
                  </Badge>
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Estoque</span>
                  <p className="font-bold">{a.estoqueAtual} un</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Média/dia</span>
                  <p className="font-bold">{a.mediaDiaria}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cobertura</span>
                  <p className={`font-bold ${
                    a.diasCobertura <= 3 ? "text-destructive" : a.diasCobertura <= 7 ? "text-amber-500" : "text-green-600"
                  }`}>
                    {a.diasCobertura === 99 ? "∞" : `${a.diasCobertura}d`}
                  </p>
                </div>
              </div>

              {/* Vendas 7d / 30d */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                <span>7d: <strong className="text-foreground">{a.vendas7d}</strong></span>
                <span>30d: <strong className="text-foreground">{a.vendas30d}</strong></span>
              </div>

              {/* Alerta de cobertura */}
              {a.diasCobertura <= 3 && a.diasCobertura !== 999 && (
                <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1">
                  <AlertTriangle className="h-3 w-3" />
                  Estoque crítico! Risco de ruptura
                </div>
              )}

              {/* Seletor de lotes */}
              {a.selecionado && (
                <div className="pt-2 border-t space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Lotes a produzir:</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        onClick={() => setLotes(a.id, a.lotesCustom - 1)}
                      >−</Button>
                      <span className="w-8 text-center font-bold text-sm">{a.lotesCustom}</span>
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        onClick={() => setLotes(a.id, a.lotesCustom + 1)}
                      >+</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    = <strong className="text-primary">{a.lotesCustom * 84}</strong> unidades
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {analises.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sem dados suficientes para gerar o plano de produção.
          </CardContent>
        </Card>
      )}

      {/* Botão de autorização */}
      {selecionados.length > 0 && (
        <div className="sticky bottom-4 z-10">
          <Card className="border-primary/50 shadow-lg">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-primary animate-pulse" />
                <span className="text-sm font-semibold">
                  {selecionados.length} sabor(es) · {totalLotes} lote(s) · {totalUnidades.toLocaleString()} un
                </span>
              </div>
              <Button
                size="lg"
                onClick={autorizarProducao}
                disabled={executando || executado}
                className="gap-2"
              >
                {executando ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Produzindo...</>
                ) : executado ? (
                  <><CheckCircle2 className="h-4 w-4" /> Produção Registrada</>
                ) : (
                  <><Factory className="h-4 w-4" /> Autorizar Produção</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rodapé padrão */}
      <p className="text-xs text-muted-foreground text-center italic pb-4">
        "Produção autorizada conforme estratégia de reposição por giro de vendas."
      </p>
    </div>
  );
}
