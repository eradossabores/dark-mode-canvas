import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, UserPlus, Target, TrendingUp, DollarSign, Users, Sparkles } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ClienteRank {
  id: string;
  nome: string;
  totalGasto: number;
  totalUnidades: number;
  vendas: number;
}

function calcularBonus(unidades: number) {
  if (unidades >= 2000) return 100;
  if (unidades >= 1000) return 50;
  return 0;
}

export default function DashboardVendedor() {
  const { user } = useAuth();
  const [unidadesMes, setUnidadesMes] = useState(0);
  const [valorMes, setValorMes] = useState(0);
  const [comissaoMes, setComissaoMes] = useState(0);
  const [novosClientesSemana, setNovosClientesSemana] = useState<any[]>([]);
  const [ranking, setRanking] = useState<ClienteRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState<string>("");

  async function load() {
    if (!user) return;
    setLoading(true);

    const inicioMes = startOfMonth(new Date()).toISOString();
    const fimMes = endOfMonth(new Date()).toISOString();
    const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    const fimSemana = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

    // Nome
    const { data: prof } = await (supabase as any).from("profiles").select("nome").eq("id", user.id).maybeSingle();
    setNome(prof?.nome || "");

    // Vínculos do vendedor
    const { data: vinculos } = await (supabase as any)
      .from("cliente_vendedor")
      .select("cliente_id, created_at, clientes(id, nome)")
      .eq("vendedor_user_id", user.id);

    const ids = (vinculos || []).map((v: any) => v.cliente_id);

    // Cadastros da semana
    const novos = (vinculos || [])
      .filter((v: any) => v.created_at >= inicioSemana && v.created_at <= fimSemana)
      .map((v: any) => ({ id: v.cliente_id, nome: v.clientes?.nome || "—", created_at: v.created_at }));
    setNovosClientesSemana(novos);

    // Vendas do mês destes clientes
    let totalUnid = 0;
    let totalValor = 0;
    const mapRank: Record<string, ClienteRank> = {};

    if (ids.length > 0) {
      const { data: vendas } = await (supabase as any)
        .from("vendas")
        .select("id, total, cliente_id, created_at, clientes(id, nome), venda_itens(quantidade)")
        .in("cliente_id", ids)
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes);

      (vendas || []).forEach((v: any) => {
        const qtd = (v.venda_itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
        totalUnid += qtd;
        totalValor += Number(v.total || 0);
        const cid = v.cliente_id;
        const cnome = v.clientes?.nome || "—";
        if (!mapRank[cid]) mapRank[cid] = { id: cid, nome: cnome, totalGasto: 0, totalUnidades: 0, vendas: 0 };
        mapRank[cid].totalGasto += Number(v.total || 0);
        mapRank[cid].totalUnidades += qtd;
        mapRank[cid].vendas += 1;
      });
    }

    setUnidadesMes(totalUnid);
    setValorMes(totalValor);
    setRanking(Object.values(mapRank).sort((a, b) => b.totalUnidades - a.totalUnidades).slice(0, 5));

    // Comissão (registrada)
    const { data: com } = await (supabase as any)
      .from("comissoes_vendas")
      .select("valor_comissao")
      .eq("vendedor_user_id", user.id)
      .gte("created_at", inicioMes)
      .lte("created_at", fimMes);
    setComissaoMes((com || []).reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0));

    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  const bonus = calcularBonus(unidadesMes);
  const proximaMeta = unidadesMes >= 2000 ? null : (unidadesMes >= 1000 ? 2000 : 1000);
  const progresso = proximaMeta ? Math.min(100, (unidadesMes / proximaMeta) * 100) : 100;
  const maxRank = ranking[0]?.totalUnidades || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            Olá{nome ? `, ${nome.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Resumo de {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/painel/vendedor/clientes">Meus Clientes</Link></Button>
          <Button asChild size="sm"><Link to="/painel/vendedor/novo-pedido">Novo Pedido</Link></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Unidades (mês)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unidadesMes}</p>
            <p className="text-xs text-muted-foreground">vendidas pelos seus clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Faturamento</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {valorMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">no mês corrente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Bônus de meta</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {bonus.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{bonus > 0 ? "Meta atingida 🎉" : `Faltam ${proximaMeta! - unidadesMes} un.`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Comissão</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {comissaoMes.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">paga no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Meta */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Progresso da meta mensal</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{unidadesMes} unidades</span>
            <span className="text-muted-foreground">{proximaMeta ? `Meta: ${proximaMeta} un.` : "Meta máxima atingida 🏆"}</span>
          </div>
          <Progress value={progresso} />
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>1.000 un = +R$ 50</span>
            <span>2.000 un = +R$ 100</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cadastros da semana */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Cadastros desta semana</span>
              <Badge variant="secondary">{novosClientesSemana.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : novosClientesSemana.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum cadastro nesta semana ainda.</p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link to="/painel/vendedor/clientes">Cadastrar cliente</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-auto">
                {novosClientesSemana.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/40 transition">
                    <span className="font-medium truncate">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "EEE dd/MM", { locale: ptBR })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Top clientes (mais compraram)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : ranking.length === 0 ? (
              <div className="text-center py-6">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sem vendas registradas no mês.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ranking.map((c, i) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {i === 0 && <Medal className="h-4 w-4 text-amber-500 shrink-0" />}
                        {i === 1 && <Medal className="h-4 w-4 text-muted-foreground shrink-0" />}
                        {i === 2 && <Medal className="h-4 w-4 text-amber-700 shrink-0" />}
                        {i > 2 && <span className="w-4 text-center text-xs text-muted-foreground shrink-0">{i + 1}</span>}
                        <span className="font-medium truncate">{c.nome}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold">{c.totalUnidades} un</span>
                        <span className="text-[10px] text-muted-foreground ml-1">(R$ {c.totalGasto.toFixed(2)} · {c.vendas}x)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${(c.totalUnidades / maxRank) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
