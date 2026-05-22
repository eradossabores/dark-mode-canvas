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

    // Get vendor's clients to identify all relevant sales
    const { data: vinculos } = await (supabase as any)
      .from("cliente_vendedor").select("cliente_id").eq("vendedor_user_id", user.id);
    const linkedIds = (vinculos || []).map((v: any) => v.cliente_id);
    
    const { data: extras } = await (supabase as any)
      .from("clientes")
      .select("id")
      .in("nome", ["AVULSO", "AMOSTRAS"]);
    
    const allRelevantClientIds = [...linkedIds, ...(extras || []).map((e: any) => e.id)];

    // 1. Carregar todas as comissões registradas
    // Filtered by current month for the totals, but we'll show them in the list
    const inicio = startOfMonth(new Date()).toISOString();
    const fim = endOfMonth(new Date()).toISOString();

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
          created_at,
          status,
          clientes (
            nome
          ),
          venda_itens (
            quantidade,
            sabores (
              nome
            )
          )
        )
      `)
      .eq("vendedor_user_id", user.id)
      .order("created_at", { ascending: false });

    // Identificar tipo de venda (Primeira Compra vs Reposição)
    // Para ser IDÊNTICO ao histórico de vendas, precisamos carregar TODAS as vendas do vendedor
    // Para ser IDÊNTICO ao histórico de vendas, precisamos carregar TODAS as vendas do vendedor
    // ordenadas para identificar a primeira de cada cliente
    const { data: todasVendasVendedor } = await (supabase as any)
      .from("vendas")
      .select("id, cliente_id, created_at, clientes(nome)")
      .in("cliente_id", allRelevantClientIds)
      .order("created_at", { ascending: true });

    const primeiraVendaPorCliente: Record<string, string> = {};
    const todasVendasArray = todasVendasVendedor || [];
    
    // Agrupar por cliente para encontrar a primeira venda de cada um
    const porCliente: Record<string, any[]> = {};
    todasVendasArray.forEach((v: any) => {
      const key = v.cliente_id || (v.clientes?.nome ? `${v.clientes?.nome}` : "avulso");
      (porCliente[key] = porCliente[key] || []).push(v);
    });

    Object.values(porCliente).forEach((arr) => {
      // Ordenar por data (antiga para nova)
      const sorted = [...arr].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (sorted.length > 0) {
        primeiraVendaPorCliente[sorted[0].cliente_id || (sorted[0].clientes?.nome ? `${sorted[0].clientes?.nome}` : "avulso")] = sorted[0].id;
      }
    });

    const comList = (com || []).map((c: any) => {
      const key = (c.vendas as any)?.cliente_id || (c.vendas as any)?.clientes?.nome || "avulso";
      const isPrimeira = primeiraVendaPorCliente[key] === c.venda_id;
      
      return {
        ...c,
        display_date: c.vendas?.created_at || c.created_at,
        is_primeira_automatic: isPrimeira
      };
    });

    setComissoes(comList);

    // 2. Calcular total de unidades baseada nas comissões do mês ATUAL
    const totalUnidadesComissao = comList
      .filter((c: any) => {
        const d = new Date(c.display_date);
        return d >= new Date(inicio) && d <= new Date(fim);
      })
      .reduce((acc: number, curr: any) => acc + Number(curr.quantidade_unidades || 0), 0);
    setUnidadesMes(totalUnidadesComissao);

    // 3. Lógica de Bônus de Fidelidade
    if (allRelevantClientIds.length > 0) {
      const hoje = new Date();
      const { data: vendasAntTudo } = await (supabase as any)
        .from("vendas")
        .select("cliente_id, created_at")
        .in("cliente_id", allRelevantClientIds)
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
      allRelevantClientIds.forEach(cid => {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: "Volume Vendido", 
            value: unidadesMes, 
            sub: null, 
            icon: TrendingUp, 
            color: "text-blue-500", 
            bg: "bg-blue-50" 
          },
          { label: "Comissões", value: `R$ ${totalComissao.toFixed(2)}`, sub: <p className="text-[10px] uppercase font-bold text-muted-foreground/60">{comissoes.length} vendas pagas</p>, icon: Receipt, color: "text-green-500", bg: "bg-green-50" },
          { label: "Bônus Fidelidade", value: `R$ ${bonusFidelizacao.toFixed(2)}`, sub: <p className="text-[10px] uppercase font-bold text-muted-foreground/60">Recompras</p>, icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
          { label: "Ajuda de Custo", value: `R$ ${ajudaCusto.toFixed(2)}`, sub: <p className="text-[10px] uppercase font-bold text-muted-foreground/60">{semanasNoMes} {semanasNoMes === 1 ? 'semana' : 'semanas'}</p>, icon: Wallet, color: "text-rose-500", bg: "bg-rose-50" },
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
                {item.sub}
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
                <p className="text-xs text-green-600 font-bold">Bônus: R$ 50,00</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-xl border border-dashed border-muted-foreground/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Meta Ouro</p>
                <p className="font-bold">2.000 un</p>
                <p className="text-xs text-green-600 font-bold">Bônus: R$ 100,00</p>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-purple-700 uppercase">Bônus de Meta Atual</p>
                <p className="text-lg font-black text-purple-900">R$ {bonusMeta.toFixed(2)}</p>
              </div>
              <Target className="h-5 w-5 text-purple-400" />
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
                      <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Data</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Cliente</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Itens</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Tipo</TableHead>
                      <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comissoes.map((c) => {
                      const itensRaw = (c.vendas as any)?.venda_itens || [];
                      const itensStr = itensRaw.length > 0 
                        ? itensRaw.map((it: any) => `${it.quantidade}x ${it.sabores?.nome || "?"}`).join(", ")
                        : "-";
                      
                      return (
                        <TableRow key={c.id} className="group transition-colors border-b last:border-0">
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            {format(new Date(c.display_date), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="font-bold text-sm text-foreground">
                            {(c.vendas as any)?.clientes?.nome || "Cliente avulso"}
                          </TableCell>
                          <TableCell className="text-[11px] max-w-[200px] truncate text-muted-foreground" title={itensStr}>
                            {itensStr}
                          </TableCell>
                          <TableCell>
                            {c.is_primeira_automatic ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] py-0 px-2 rounded-full h-5">Primeira Compra</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px] py-0 px-2 rounded-full h-5">Reposição</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-black text-sm text-green-600">
                              R$ {Number(c.valor_comissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
