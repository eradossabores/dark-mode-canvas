import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { differenceInDays, format } from "date-fns";

interface FactoryHealth {
  id: string;
  name: string;
  vendasMes: number;
  faturamentoMes: number;
  producoesMes: number;
  lastAccess: string | null;
  diasInativo: number;
  status: "saudavel" | "atencao" | "critico";
}

export default function PainelSaudeGeral() {
  const [factories, setFactories] = useState<FactoryHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [{ data: fabs }, { data: vendas }, { data: producoes }, { data: sessions }] = await Promise.all([
        (supabase as any).from("factories").select("id, name"),
        (supabase as any).from("vendas").select("factory_id, total").gte("created_at", mesInicio).neq("status", "cancelada"),
        (supabase as any).from("producoes").select("factory_id, quantidade_total").gte("created_at", mesInicio),
        (supabase as any).from("user_sessions").select("factory_id, last_seen").order("last_seen", { ascending: false }),
      ]);

      const fabMap: Record<string, FactoryHealth> = {};
      (fabs || []).forEach((f: any) => {
        fabMap[f.id] = { id: f.id, name: f.name, vendasMes: 0, faturamentoMes: 0, producoesMes: 0, lastAccess: null, diasInativo: 999, status: "saudavel" };
      });

      (vendas || []).forEach((v: any) => {
        if (fabMap[v.factory_id]) { fabMap[v.factory_id].vendasMes += 1; fabMap[v.factory_id].faturamentoMes += Number(v.total); }
      });

      (producoes || []).forEach((p: any) => {
        if (fabMap[p.factory_id]) fabMap[p.factory_id].producoesMes += p.quantidade_total;
      });

      (sessions || []).forEach((s: any) => {
        if (fabMap[s.factory_id] && !fabMap[s.factory_id].lastAccess) {
          fabMap[s.factory_id].lastAccess = s.last_seen;
          fabMap[s.factory_id].diasInativo = differenceInDays(new Date(), new Date(s.last_seen));
        }
      });

      Object.values(fabMap).forEach(f => {
        if (f.diasInativo > 14 || (f.vendasMes === 0 && f.producoesMes === 0)) f.status = "critico";
        else if (f.diasInativo > 7 || f.vendasMes < 3) f.status = "atencao";
      });

      setFactories(Object.values(fabMap).sort((a, b) => {
        const order = { critico: 0, atencao: 1, saudavel: 2 };
        return order[a.status] - order[b.status];
      }));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const formatBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const criticos = factories.filter(f => f.status === "critico").length;
  const atencao = factories.filter(f => f.status === "atencao").length;

  if (loading) return <div className="animate-pulse p-4 text-muted-foreground">Carregando saúde geral...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3"><CheckCircle className="h-5 w-5 text-green-500" /><div><p className="text-xs text-muted-foreground">Saudáveis</p><p className="text-xl font-bold">{factories.length - criticos - atencao}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-500" /><div><p className="text-xs text-muted-foreground">Atenção</p><p className="text-xl font-bold">{atencao}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><XCircle className="h-5 w-5 text-red-500" /><div><p className="text-xs text-muted-foreground">Críticos</p><p className="text-xl font-bold">{criticos}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Saúde das Fábricas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fábrica</TableHead>
                <TableHead className="text-right">Vendas/Mês</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Produção</TableHead>
                <TableHead className="text-right">Dias Inativo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factories.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="text-right">{f.vendasMes}</TableCell>
                  <TableCell className="text-right">{formatBRL(f.faturamentoMes)}</TableCell>
                  <TableCell className="text-right">{f.producoesMes.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{f.diasInativo < 999 ? f.diasInativo : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "critico" ? "destructive" : f.status === "atencao" ? "outline" : "default"}>
                      {f.status === "critico" ? "🔴 Crítico" : f.status === "atencao" ? "🟡 Atenção" : "🟢 Saudável"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
