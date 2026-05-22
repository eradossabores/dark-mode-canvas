import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, DollarSign, Users, CheckCircle2, Clock, Wallet } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const ERA_DOS_SABORES_ID = "00000000-0000-0000-0000-000000000001";

type Periodo = "semanal" | "mensal";

interface Vendedor { user_id: string; nome: string; email: string | null; }
interface VendaRow {
  id: string;
  created_at: string;
  total: number;
  status: string;
  cliente_nome: string;
  unidades: number;
  comissao_valor: number;
  comissao_status: "paga" | "pendente" | "sem_comissao";
  comissao_id: string | null;
  faixa: string;
  recorrente: boolean;
}

function calcularFaixa(qtd: number, recorrente: boolean) {
  let faixa = "sem_comissao", base = 0;
  if (qtd >= 400) { faixa = "400+"; base = 26; }
  else if (qtd >= 300) { faixa = "300"; base = 24; }
  else if (qtd >= 200) { faixa = "200"; base = 22.5; }
  else if (qtd >= 100) { faixa = "100"; base = 20; }
  const valor = recorrente ? +(base * 0.5).toFixed(2) : base;
  return { faixa, base, valor };
}

const isPago = (s: string) => ["pago", "paga", "pago_total", "quitado", "quitada"].includes((s || "").toLowerCase());

export default function Vendedores() {
  const { factoryId, role } = useAuth();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selected, setSelected] = useState<Vendedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("mensal");

  const { factoryId, role } = useAuth();
  const isEra = factoryId === ERA_DOS_SABORES_ID || role === "super_admin";

  useEffect(() => {
    if (!isEra) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: roles } = await (supabase as any)
        .from("user_roles").select("user_id").eq("factory_id", factoryId).eq("role", "vendedor");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) { setVendedores([]); setLoading(false); return; }
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, nome, email").in("id", ids);
      setVendedores((profs || []).map((p: any) => ({ user_id: p.id, nome: p.nome || p.email, email: p.email })));
      setLoading(false);
    })();
  }, [factoryId, isEra]);

  async function loadVendasVendedor(v: Vendedor) {
    setSelected(v);
    setVendas([]);
    const range = periodo === "semanal"
      ? { ini: startOfWeek(new Date(), { weekStartsOn: 1 }), fim: endOfWeek(new Date(), { weekStartsOn: 1 }) }
      : { ini: startOfMonth(new Date()), fim: endOfMonth(new Date()) };

    const { data: vinc } = await (supabase as any)
      .from("cliente_vendedor").select("cliente_id").eq("vendedor_user_id", v.user_id);
    const cliIds = (vinc || []).map((x: any) => x.cliente_id);
    if (cliIds.length === 0) return;

    const { data: vd } = await (supabase as any)
      .from("vendas").select("id, created_at, total, status, cliente_id")
      .in("cliente_id", cliIds)
      .gte("created_at", range.ini.toISOString())
      .lte("created_at", range.fim.toISOString())
      .order("created_at", { ascending: false });

    const vendaIds = (vd || []).map((x: any) => x.id);
    if (vendaIds.length === 0) { setVendas([]); return; }

    const [itensRes, comRes, cliRes] = await Promise.all([
      (supabase as any).from("venda_itens").select("venda_id, quantidade").in("venda_id", vendaIds),
      (supabase as any).from("comissoes_vendas").select("id, venda_id, valor_comissao, status, faixa, recorrente")
        .in("venda_id", vendaIds).eq("vendedor_user_id", v.user_id),
      (supabase as any).from("clientes").select("id, nome").in("id", cliIds),
    ]);

    const qtdMap: Record<string, number> = {};
    (itensRes.data || []).forEach((it: any) => { qtdMap[it.venda_id] = (qtdMap[it.venda_id] || 0) + Number(it.quantidade || 0); });
    const comMap: Record<string, any> = {};
    (comRes.data || []).forEach((c: any) => { comMap[c.venda_id] = c; });
    const cliMap: Record<string, string> = {};
    (cliRes.data || []).forEach((c: any) => { cliMap[c.id] = c.nome; });

    // Determinar recorrência por cliente (primeira venda do Yuri vs subsequentes)
    const firstPerCliente: Record<string, string> = {};
    [...(vd || [])].forEach((s: any) => {
      const cur = firstPerCliente[s.cliente_id];
      if (!cur || new Date(s.created_at) < new Date(cur)) firstPerCliente[s.cliente_id] = s.created_at;
    });

    const rows: VendaRow[] = (vd || []).map((s: any) => {
      const qtd = qtdMap[s.id] || 0;
      const com = comMap[s.id];
      const recorrente = com ? com.recorrente : firstPerCliente[s.cliente_id] !== s.created_at;
      const calc = calcularFaixa(qtd, recorrente);
      return {
        id: s.id,
        created_at: s.created_at,
        total: Number(s.total || 0),
        status: s.status,
        cliente_nome: cliMap[s.cliente_id] || "—",
        unidades: qtd,
        comissao_valor: com ? Number(com.valor_comissao) : calc.valor,
        comissao_status: com ? com.status : (calc.valor > 0 ? "pendente" : "sem_comissao"),
        comissao_id: com?.id || null,
        faixa: com?.faixa || calc.faixa,
        recorrente,
      };
    });
    setVendas(rows);
  }

  useEffect(() => { if (selected) loadVendasVendedor(selected); /* eslint-disable-next-line */ }, [periodo]);

  async function marcarComissaoPaga(row: VendaRow) {
    if (!row.comissao_id) {
      // criar registro de comissão manualmente (caso a venda ainda não esteja marcada como paga)
      const { data, error } = await (supabase as any).from("comissoes_vendas").insert({
        factory_id: factoryId,
        venda_id: row.id,
        vendedor_user_id: selected!.user_id,
        quantidade_unidades: row.unidades,
        faixa: row.faixa,
        valor_base: row.recorrente ? row.comissao_valor * 2 : row.comissao_valor,
        recorrente: row.recorrente,
        valor_comissao: row.comissao_valor,
        status: "paga",
        pago_em: new Date().toISOString(),
      }).select().single();
      if (error) { toast.error("Erro ao registrar comissão: " + error.message); return; }
      toast.success("Comissão paga registrada");
    } else {
      const { error } = await (supabase as any).from("comissoes_vendas")
        .update({ status: "paga", pago_em: new Date().toISOString() }).eq("id", row.comissao_id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Comissão marcada como paga");
    }
    if (selected) loadVendasVendedor(selected);
  }

  const totais = useMemo(() => {
    const totalVendido = vendas.reduce((s, v) => s + v.total, 0);
    const comissaoPendente = vendas.filter(v => v.comissao_status === "pendente").reduce((s, v) => s + v.comissao_valor, 0);
    const comissaoPaga = vendas.filter(v => v.comissao_status === "paga").reduce((s, v) => s + v.comissao_valor, 0);
    return { totalVendido, comissaoPendente, comissaoPaga, qtd: vendas.length };
  }, [vendas]);

  if (!isEra) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        Esta seção é exclusiva da fábrica A Era dos Sabores.
      </CardContent></Card>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setVendas([]); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{selected.nome}</h1>
              <p className="text-xs text-muted-foreground">{selected.email}</p>
            </div>
          </div>
          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
            <Button size="sm" variant={periodo === "semanal" ? "default" : "ghost"} onClick={() => setPeriodo("semanal")}>Semanal</Button>
            <Button size="sm" variant={periodo === "mensal" ? "default" : "ghost"} onClick={() => setPeriodo("mensal")}>Mensal</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vendas</p><p className="text-2xl font-bold">{totais.qtd}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total vendido</p><p className="text-2xl font-bold">R$ {totais.totalVendido.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Comissão pendente</p><p className="text-2xl font-bold text-amber-600">R$ {totais.comissaoPendente.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Comissão paga</p><p className="text-2xl font-bold text-emerald-600">R$ {totais.comissaoPaga.toFixed(2)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Vendas — {periodo === "semanal" ? "Esta semana" : format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Un.</TableHead>
                  <TableHead>Total</TableHead><TableHead>Tipo</TableHead><TableHead>Venda</TableHead>
                  <TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vendas.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma venda no período.</TableCell></TableRow>
                  ) : vendas.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs">{format(new Date(v.created_at), "dd/MM HH:mm")}</TableCell>
                      <TableCell className="font-medium">{v.cliente_nome}</TableCell>
                      <TableCell>{v.unidades}</TableCell>
                      <TableCell>R$ {v.total.toFixed(2)}</TableCell>
                      <TableCell>{v.recorrente ? <Badge variant="secondary">Recompra</Badge> : <Badge>1ª compra</Badge>}</TableCell>
                      <TableCell>
                        <Badge variant={isPago(v.status) ? "default" : "outline"}>{isPago(v.status) ? "Paga" : "Pendente"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">R$ {v.comissao_valor.toFixed(2)}</TableCell>
                      <TableCell>
                        {v.comissao_status === "paga" ? <Badge className="bg-emerald-600">Paga</Badge>
                          : v.comissao_status === "pendente" ? <Badge variant="outline" className="text-amber-600 border-amber-600">Pendente</Badge>
                          : <Badge variant="secondary">—</Badge>}
                      </TableCell>
                      <TableCell>
                        {v.comissao_status !== "paga" && v.comissao_valor > 0 && (
                          <Button size="sm" variant="outline" onClick={() => marcarComissaoPaga(v)}>
                            <Wallet className="h-3 w-3 mr-1" /> Marcar paga
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Vendedores</h1>
        <p className="text-sm text-muted-foreground">Acompanhe vendas e comissões de cada vendedor.</p>
      </div>

      {loading ? <p className="text-muted-foreground">Carregando...</p> : vendedores.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum vendedor cadastrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendedores.map((v) => (
            <Card key={v.user_id} className="hover:border-primary cursor-pointer transition-colors" onClick={() => loadVendasVendedor(v)}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{v.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.email}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}