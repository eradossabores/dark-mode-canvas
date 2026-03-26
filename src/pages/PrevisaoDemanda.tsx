import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Brain, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

interface PrevisaoSabor {
  nome: string;
  mediaDiaria7d: number;
  mediaDiaria30d: number;
  tendencia: "alta" | "baixa" | "estavel";
  estoqueAtual: number;
  sugestaoProducao: number;
  diasCobertura: number;
}

export default function PrevisaoDemanda() {
  const { factoryId, role } = useAuth();
  const [previsoes, setPrevisoes] = useState<PrevisaoSabor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role !== "super_admin" && !factoryId) return;
    calcular();
  }, [factoryId, role]);

  async function calcular() {
    setLoading(true);
    try {
      let vendasQ = (supabase as any).from("venda_itens").select("sabor_id, quantidade, sabores(nome), vendas!inner(created_at, status)");
      let gelosQ = (supabase as any).from("estoque_gelos").select("quantidade, sabores(nome, id)");
      if (factoryId) {
        vendasQ = vendasQ.eq("factory_id", factoryId);
        gelosQ = gelosQ.eq("factory_id", factoryId);
      }
      const [vendasRes, gelosRes] = await Promise.all([vendasQ, gelosQ]);

      const vendaItens = (vendasRes.data || []).filter((v: any) => v.vendas?.status !== "cancelada");
      const gelos = gelosRes.data || [];

      const agora = new Date();
      const seteDias = new Date(agora); seteDias.setDate(seteDias.getDate() - 7);
      const trintaDias = new Date(agora); trintaDias.setDate(trintaDias.getDate() - 30);

      // Group by sabor
      const saborMap: Record<string, { nome: string; vendas7d: number; vendas30d: number }> = {};
      
      vendaItens.forEach((item: any) => {
        const id = item.sabor_id;
        const nome = item.sabores?.nome || "?";
        if (!saborMap[id]) saborMap[id] = { nome, vendas7d: 0, vendas30d: 0 };
        
        const dt = new Date(item.vendas?.created_at);
        if (dt >= seteDias) saborMap[id].vendas7d += item.quantidade;
        if (dt >= trintaDias) saborMap[id].vendas30d += item.quantidade;
      });

      const result: PrevisaoSabor[] = [];

      Object.entries(saborMap).forEach(([saborId, data]) => {
        const mediaDiaria7d = data.vendas7d / 7;
        const mediaDiaria30d = data.vendas30d / 30;
        
        let tendencia: "alta" | "baixa" | "estavel" = "estavel";
        if (mediaDiaria7d > mediaDiaria30d * 1.2) tendencia = "alta";
        else if (mediaDiaria7d < mediaDiaria30d * 0.8) tendencia = "baixa";

        const gelo = gelos.find((g: any) => g.sabores?.id === saborId);
        const estoqueAtual = gelo?.quantidade || 0;
        const diasCobertura = mediaDiaria7d > 0 ? Math.floor(estoqueAtual / mediaDiaria7d) : 999;

        // Suggest production for 7 days coverage
        const necessario7d = Math.ceil(mediaDiaria7d * 7);
        const sugestaoProducao = Math.max(0, necessario7d - estoqueAtual);

        result.push({
          nome: data.nome,
          mediaDiaria7d: Math.round(mediaDiaria7d * 10) / 10,
          mediaDiaria30d: Math.round(mediaDiaria30d * 10) / 10,
          tendencia,
          estoqueAtual,
          sugestaoProducao,
          diasCobertura: Math.min(diasCobertura, 99),
        });
      });

      result.sort((a, b) => a.diasCobertura - b.diasCobertura);
      setPrevisoes(result);
    } catch (e) {
      console.error("PrevisaoDemanda error:", e);
    } finally {
      setLoading(false);
    }
  }

  const chartData = previsoes.slice(0, 10).map(p => ({
    name: p.nome,
    sugestao: p.sugestaoProducao,
    estoque: p.estoqueAtual,
  }));

  const tendenciaIcon = (t: string) => {
    if (t === "alta") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (t === "baixa") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Previsão de Demanda</h2>
        </div>
        <Button variant="outline" size="sm" onClick={calcular} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Análise baseada nas vendas dos últimos 7 e 30 dias. Sugestões de produção para cobertura de 7 dias.
      </p>

      {previsoes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Sugestão de Produção vs Estoque Atual</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                <Tooltip />
                <Bar dataKey="estoque" name="Estoque Atual" fill="hsl(200,98%,39%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="sugestao" name="Produzir" fill="hsl(38,92%,50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {previsoes.map(p => (
          <Card key={p.nome} className={p.diasCobertura <= 3 ? "border-destructive/50" : p.diasCobertura <= 7 ? "border-amber-500/50" : ""}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{p.nome}</span>
                <div className="flex items-center gap-1">
                  {tendenciaIcon(p.tendencia)}
                  <Badge variant={p.tendencia === "alta" ? "default" : p.tendencia === "baixa" ? "destructive" : "secondary"} className="text-[10px]">
                    {p.tendencia}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Média 7d</span>
                  <p className="font-bold">{p.mediaDiaria7d}/dia</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Média 30d</span>
                  <p className="font-bold">{p.mediaDiaria30d}/dia</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estoque</span>
                  <p className="font-bold">{p.estoqueAtual} un</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cobertura</span>
                  <p className={`font-bold ${p.diasCobertura <= 3 ? "text-destructive" : p.diasCobertura <= 7 ? "text-amber-500" : ""}`}>
                    {p.diasCobertura}d
                  </p>
                </div>
              </div>

              {p.sugestaoProducao > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Sugestão de produção:</span>
                  <p className="text-lg font-bold text-primary">{p.sugestaoProducao} un</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {previsoes.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Sem dados de vendas suficientes para gerar previsões.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
