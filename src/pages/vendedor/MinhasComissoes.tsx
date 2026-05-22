import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  Target, 
  TrendingUp, 
  Wallet, 
  Award, 
  Calendar, 
  Receipt,
  CheckCircle2,
  Clock,
  ChevronRight
} from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const AJUDA_CUSTO_SEMANAL = 80;

function calcularBonus(unidades: number) {
  if (unidades >= 2000) return 100;
  if (unidades >= 1000) return 50;
  return 0;
}

export default function MinhasComissoes() {
  const { user } = useAuth();
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [unidadesMes, setUnidadesMes] = useState(0);
  const [bonusFidelizacao, setBonusFidelizacao] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const inicio = startOfMonth(new Date()).toISOString();
    const fim = endOfMonth(new Date()).toISOString();

    // 1. Carregar todas as comissões do mês atual (Fonte de verdade para unidades e ganhos)
    const { data: com } = await (supabase as any)
      .from("comissoes_vendas")
      .select(`
        id, 
        created_at, 
        quantidade_unidades, 
        faixa, 
        valor_base, 
        recorrente, 
        valor_comissao, 
        status, 
        venda_id,
        vendas!venda_id (
          clientes (
            nome
          )
        )
      `)
      .eq("vendedor_user_id", user.id)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false });

    const comList = com || [];
    setComissoes(comList);

    // 2. Calcular total de unidades baseada nas comissões geradas no mês
    const totalUnidadesComissao = comList.reduce((acc: number, curr: any) => acc + Number(curr.quantidade_unidades || 0), 0);
    setUnidadesMes(totalUnidadesComissao);

    // 3. Lógica de Bônus de Fidelidade (permanece baseada no histórico de vendas dos clientes)
    const { data: vinculos } = await (supabase as any)
      .from("cliente_vendedor").select("cliente_id").eq("vendedor_user_id", user.id);
    const ids = (vinculos || []).map((v: any) => v.cliente_id);
    
    const { data: extras } = await (supabase as any)
      .from("clientes")
      .select("id")
      .in("nome", ["AVULSO", "AMOSTRAS"]);
    
    const allIds = [...ids, ...(extras || []).map((e: any) => e.id)];
    
    if (allIds.length > 0) {
      const hoje = new Date();
      const { data: vendasAntTudo } = await (supabase as any)
        .from("vendas")
        .select("cliente_id, created_at")
        .in("cliente_id", allIds)
        .eq("status", "paga")
        .gte("created_at", subMonths(startOfMonth(hoje), 6).toISOString());

      const vendasPorMes: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() };
      (vendasAntTudo || []).forEach((v: any) => {
        const dt = new Date(v.created_at);
        for (let i = 1; i <= 6; i++) {
          const ini = startOfMonth(subMonths(hoje, i));
          const fim = endOfMonth(subMonths(hoje, i));
          if (dt >= ini && dt <= fim) vendasPorMes[i].add(v.cliente_id);
        }
      });

      let totalBonusFid = 0;
      allIds.forEach(cid => {
        let consec = 0;
        if (vendasPorMes[1].has(cid) && vendasPorMes[2].has(cid) && vendasPorMes[3].has(cid)) {
          consec = 3;
          if (vendasPorMes[4].has(cid) && vendasPorMes[5].has(cid) && vendasPorMes[6].has(cid)) consec = 6;
        }
        if (consec === 6) totalBonusFid += 100;
        else if (consec === 3) totalBonusFid += 50;
      });
      setBonusFidelizacao(totalBonusFid);
    }
    
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);
  
  const semanasNoMes = useMemo(() => {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    if (diaAtual <= 7) return 1;
    if (diaAtual <= 14) return 2;
    if (diaAtual <= 21) return 3;
    if (diaAtual <= 28) return 4;
    return 5;
  }, []);

  const totalComissao = useMemo(() => {
    return comissoes
      .filter(c => ["paga", "pago", "reposicao"].includes(c.status))
      .reduce((s, c) => s + Number(c.valor_comissao || 0), 0);
  }, [comissoes]);

  const bonusMeta = calcularBonus(unidadesMes);
  const ajudaCusto = AJUDA_CUSTO_SEMANAL * semanasNoMes; 
  const totalGeral = totalComissao + bonusMeta + bonusFidelizacao + ajudaCusto;

  const meta1 = 1000;
  const meta2 = 2000;
  const metaAtiva = unidadesMes < meta1 ? meta1 : meta2;
  const progresso = Math.min(100, (unidadesMes / metaAtiva) * 100);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-background to-background p-6 rounded-2xl border border-primary/20">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-lg">
              <DollarSign className="h-7 w-7" />
            </div>
            Minhas Comissões
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Período: {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Estimado</span>
          <div className="text-3xl font-black text-primary">
            R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Volume Vendido", value: unidadesMes, sub: "unidades", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Comissões", value: `R$ ${totalComissao.toFixed(2)}`, sub: `${comissoes.length} vendas pagas`, icon: Receipt, color: "text-green-500", bg: "bg-green-50" },
          { label: "Bônus Meta", value: `R$ ${bonusMeta.toFixed(2)}`, sub: bonusMeta > 0 ? "Meta atingida!" : `Próxima: ${metaAtiva} un.`, icon: Target, color: "text-purple-500", bg: "bg-purple-50" },
          { label: "Bônus Fidelidade", value: `R$ ${bonusFidelizacao.toFixed(2)}`, sub: "Recompras", icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
          { label: "Ajuda de Custo", value: `R$ ${ajudaCusto.toFixed(2)}`, sub: `${semanasNoMes} ${semanasNoMes === 1 ? 'semana' : 'semanas'}`, icon: Wallet, color: "text-rose-500", bg: "bg-rose-50" },
        ].map((item, i) => (
          <Card key={i} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2 rounded-xl transition-colors", item.bg, item.color)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black tracking-tight">{item.value}</p>
                <p className="text-xs font-medium text-muted-foreground truncate">{item.label}</p>
                <p className="text-[10px] uppercase font-bold text-muted-foreground/60">{item.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-lg border-primary/10 overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Progresso Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black">{unidadesMes} <span className="text-sm font-normal text-muted-foreground">un</span></span>
                <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded">Meta: {metaAtiva}</span>
              </div>
              <div className="relative pt-2">
                <Progress value={progresso} className="h-3 shadow-inner" />
                {progresso >= 100 && (
                  <div className="absolute -right-1 -top-1 bg-green-500 text-white rounded-full p-1 shadow-lg animate-bounce">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-muted/50 p-3 rounded-xl border border-dashed border-muted-foreground/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Meta Bronze</p>
                <p className="font-bold">1.000 un</p>
                <p className="text-xs text-green-600 font-bold">+R$ 50,00</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-xl border border-dashed border-muted-foreground/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Meta Ouro</p>
                <p className="font-bold">2.000 un</p>
                <p className="text-xs text-green-600 font-bold">+R$ 100,00</p>
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-full">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase">Dica do Iury</p>
                  <p className="text-xs text-muted-foreground">Faltam {Math.max(0, metaAtiva - unidadesMes)} unidades para o próximo bônus!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg border-none overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Extrato Detalhado
            </CardTitle>
            <Badge variant="outline" className="font-mono">{comissoes.length} itens</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 text-center space-y-3">
                <Clock className="h-10 w-10 text-primary/20 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Sincronizando dados...</p>
              </div>
            ) : comissoes.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Receipt className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <div className="max-w-[250px] mx-auto">
                  <p className="font-bold">Nenhuma comissão</p>
                  <p className="text-sm text-muted-foreground">As comissões aparecem aqui automaticamente após o pagamento da venda.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20">
                      <TableHead className="w-[120px] font-bold">Data</TableHead>
                      <TableHead className="font-bold">Cliente</TableHead>
                      <TableHead className="font-bold">Unidades</TableHead>
                      <TableHead className="font-bold">Tipo</TableHead>
                      <TableHead className="text-right font-bold">Comissão</TableHead>
                      <TableHead className="w-[100px] text-center font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comissoes.map((c) => (
                      <TableRow key={c.id} className="group transition-colors">
                        <TableCell className="font-medium">
                          {format(new Date(c.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {(c.vendas as any)?.clientes?.nome || "Cliente avulso"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{c.quantidade_unidades}</span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">un</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.recorrente ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none font-bold text-[10px] py-0">RECOMPRA</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-700 border-none font-bold text-[10px] py-0">NOVA VENDA</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono font-bold text-primary">
                            R$ {Number(c.valor_comissao).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            {["paga", "pago", "reposicao"].includes(c.status) ? (
                              <div className="bg-green-500/10 p-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </div>
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
