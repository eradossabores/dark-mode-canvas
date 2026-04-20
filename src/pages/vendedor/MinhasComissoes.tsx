import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Target, TrendingUp, Wallet } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AJUDA_CUSTO_SEMANAL = 80;

function calcularBonus(unidades: number) {
  if (unidades >= 2000) return 100;
  if (unidades >= 1000) return 50;
  return 0;
}

export default function MinhasComissoes() {
  const { user, factoryId } = useAuth();
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [unidadesMes, setUnidadesMes] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const inicio = startOfMonth(new Date()).toISOString();
    const fim = endOfMonth(new Date()).toISOString();

    // Comissões registradas (já contabilizadas via trigger ao marcar venda como paga)
    const { data: com } = await (supabase as any)
      .from("comissoes_vendas")
      .select("id, created_at, quantidade_unidades, faixa, valor_base, recorrente, valor_comissao, status, venda_id")
      .eq("vendedor_user_id", user.id)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false });
    setComissoes(com || []);

    // Unidades vendidas no mês (de TODAS as vendas dos clientes do vendedor)
    const { data: vinculos } = await (supabase as any)
      .from("cliente_vendedor").select("cliente_id").eq("vendedor_user_id", user.id);
    const ids = (vinculos || []).map((v: any) => v.cliente_id);
    if (ids.length > 0) {
      const { data: vendas } = await (supabase as any)
        .from("vendas").select("id, created_at, cliente_id")
        .in("cliente_id", ids).gte("created_at", inicio).lte("created_at", fim);
      const vendaIds = (vendas || []).map((v: any) => v.id);
      if (vendaIds.length > 0) {
        const { data: itens } = await (supabase as any)
          .from("venda_itens").select("quantidade, venda_id").in("venda_id", vendaIds);
        const total = (itens || []).reduce((s: number, it: any) => s + Number(it.quantidade || 0), 0);
        setUnidadesMes(total);
      } else {
        setUnidadesMes(0);
      }
    } else {
      setUnidadesMes(0);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  const totalComissao = useMemo(() => comissoes.reduce((s, c) => s + Number(c.valor_comissao || 0), 0), [comissoes]);
  const bonus = calcularBonus(unidadesMes);
  const ajudaCusto = AJUDA_CUSTO_SEMANAL * 4; // estimativa mensal
  const totalGeral = totalComissao + bonus + ajudaCusto;

  const proximaMeta = unidadesMes >= 2000 ? null : (unidadesMes >= 1000 ? 2000 : 1000);
  const progresso = proximaMeta ? Math.min(100, (unidadesMes / proximaMeta) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" /> Minhas Comissões</h1>
        <p className="text-sm text-muted-foreground">Resumo do mês de {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Volume vendido</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unidadesMes}</p>
            <p className="text-xs text-muted-foreground">unidades este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Comissão (paga)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {totalComissao.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{comissoes.length} venda(s) com comissão</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Bônus de meta</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {bonus.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{bonus > 0 ? `Meta atingida` : `Próxima: ${proximaMeta} un.`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Ajuda de custo</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {ajudaCusto.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">R$ {AJUDA_CUSTO_SEMANAL}/semana × 4</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Progresso de meta mensal</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{unidadesMes} unidades</span>
            <span>{proximaMeta ? `Meta: ${proximaMeta}` : "Meta máxima atingida 🎉"}</span>
          </div>
          <Progress value={progresso} />
          <div className="flex justify-between text-xs text-muted-foreground pt-2">
            <span>1.000 un = +R$ 50</span>
            <span>2.000 un = +R$ 100</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Total a receber no mês: R$ {totalGeral.toFixed(2)}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : comissoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma comissão registrada ainda este mês. As comissões aparecem aqui quando a venda é marcada como paga.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Unidades</TableHead><TableHead>Faixa</TableHead>
                <TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {comissoes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{c.quantidade_unidades}</TableCell>
                    <TableCell>{c.faixa}</TableCell>
                    <TableCell>{c.recorrente ? <Badge variant="secondary">Recompra (50%)</Badge> : <Badge>Nova</Badge>}</TableCell>
                    <TableCell className="text-right font-mono">R$ {Number(c.valor_comissao).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={c.status === "paga" ? "default" : "outline"}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}