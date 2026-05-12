import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Users, DollarSign } from "lucide-react";

type Periodo = "diario" | "semanal" | "mensal";

interface Props { factoryId: string | null }

interface VendedorStat {
  user_id: string;
  nome: string;
  total: number;
  pedidos: number;
  unidades: number;
  clientes: number;
  ticketMedio: number;
}

const PERIODOS: { value: Periodo; label: string; dias: number }[] = [
  { value: "diario", label: "Diário", dias: 1 },
  { value: "semanal", label: "Semanal", dias: 7 },
  { value: "mensal", label: "Mensal", dias: 30 },
];

export default function DesempenhoVendedores({ factoryId }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("semanal");
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [clienteVendedor, setClienteVendedor] = useState<Record<string, string>>({});
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);

  useEffect(() => {
    if (!factoryId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const dias = PERIODOS.find((p) => p.value === periodo)!.dias;
      const start = new Date();
      if (dias === 1) {
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(start.getDate() - (dias - 1));
        start.setHours(0, 0, 0, 0);
      }
      const startIso = start.toISOString();

      const [rolesRes, cvRes, vendasRes] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("factory_id", factoryId).eq("role", "vendedor"),
        supabase.from("cliente_vendedor").select("cliente_id, vendedor_user_id").eq("factory_id", factoryId),
        supabase
          .from("vendas")
          .select("id, cliente_id, total, created_at, status")
          .eq("factory_id", factoryId)
          .gte("created_at", startIso),
      ]);

      const userIds = (rolesRes.data || []).map((r: any) => r.user_id);
      const profilesRes = userIds.length
        ? await supabase.from("profiles").select("id, nome, email").in("id", userIds)
        : { data: [] as any[] };
      const profMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        profMap[p.id] = p.nome || p.email || "Vendedor";
      });
      const vList = userIds.map((id) => ({ id, nome: profMap[id] || "Vendedor" }));

      const cvMap: Record<string, string> = {};
      (cvRes.data || []).forEach((cv: any) => {
        cvMap[cv.cliente_id] = cv.vendedor_user_id;
      });

      const vendaIds = (vendasRes.data || []).map((v: any) => v.id);
      const itensRes = vendaIds.length
        ? await supabase.from("venda_itens").select("venda_id, quantidade").in("venda_id", vendaIds)
        : { data: [] as any[] };

      if (cancel) return;
      setVendedores(vList);
      setClienteVendedor(cvMap);
      setVendas(vendasRes.data || []);
      setItens(itensRes.data || []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [factoryId, periodo]);

  const stats = useMemo<VendedorStat[]>(() => {
    const itensMap: Record<string, number> = {};
    itens.forEach((it: any) => {
      itensMap[it.venda_id] = (itensMap[it.venda_id] || 0) + Number(it.quantidade || 0);
    });
    const acc: Record<string, VendedorStat> = {};
    vendedores.forEach((v) => {
      acc[v.id] = { user_id: v.id, nome: v.nome, total: 0, pedidos: 0, unidades: 0, clientes: 0, ticketMedio: 0 };
    });
    const clientesPorVendedor: Record<string, Set<string>> = {};
    vendas.forEach((v: any) => {
      const vendId = clienteVendedor[v.cliente_id];
      if (!vendId || !acc[vendId]) return;
      acc[vendId].total += Number(v.total || 0);
      acc[vendId].pedidos += 1;
      acc[vendId].unidades += itensMap[v.id] || 0;
      if (!clientesPorVendedor[vendId]) clientesPorVendedor[vendId] = new Set();
      clientesPorVendedor[vendId].add(v.cliente_id);
    });
    Object.keys(acc).forEach((k) => {
      acc[k].clientes = clientesPorVendedor[k]?.size || 0;
      acc[k].ticketMedio = acc[k].pedidos > 0 ? acc[k].total / acc[k].pedidos : 0;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [vendas, itens, vendedores, clienteVendedor]);

  const totalGeral = stats.reduce((s, v) => s + v.total, 0);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card className="border-0 bg-background h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Desempenho dos Vendedores
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Total no período: <span className="font-semibold text-foreground">{fmt(totalGeral)}</span>
            </p>
          </div>
          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
            {PERIODOS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={periodo === p.value ? "default" : "ghost"}
                className="h-7 text-xs px-3"
                onClick={() => setPeriodo(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : stats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum vendedor cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {stats.map((v, i) => {
              const pct = totalGeral > 0 ? (v.total / totalGeral) * 100 : 0;
              return (
                <div key={v.user_id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={i === 0 ? "default" : "secondary"} className="h-6 w-6 p-0 flex items-center justify-center text-xs shrink-0">
                        {i + 1}
                      </Badge>
                      <span className="text-sm font-medium truncate">{v.nome}</span>
                    </div>
                    <span className="text-sm font-bold text-primary tabular-nums shrink-0">{fmt(v.total)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground pl-8">
                    <div className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{v.pedidos} pedidos</div>
                    <div className="flex items-center gap-1"><Users className="h-3 w-3" />{v.clientes} clientes</div>
                    <div>{v.unidades} un.</div>
                    <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" />Tk {fmt(v.ticketMedio)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}