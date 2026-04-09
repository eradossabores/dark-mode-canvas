import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays } from "date-fns";

export default function RelatorioInadimplenciaPreditiva() {
  const { factoryId, factoryName } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [parcelas, setParcelas] = useState<any[]>([]);

  useEffect(() => { if (factoryId) load(); }, [factoryId]);

  async function load() {
    const [{ data: c }, { data: v }, { data: p }] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome").eq("factory_id", factoryId).eq("status", "ativo"),
      (supabase as any).from("vendas").select("id, cliente_id, total, saldo_restante, created_at").eq("factory_id", factoryId).neq("status", "cancelada"),
      (supabase as any).from("venda_parcelas").select("venda_id, vencimento, pago").eq("factory_id", factoryId),
    ]);
    setClientes(c || []);
    setVendas(v || []);
    setParcelas(p || []);
  }

  const clienteNome: Record<string, string> = {};
  (clientes || []).forEach(c => { clienteNome[c.id] = c.nome; });

  // Build score per client
  const scores: Record<string, { nome: string; totalVendas: number; totalDevido: number; parcelasAtrasadas: number; parcelasTotal: number; maiorAtraso: number }> = {};

  (vendas || []).forEach(v => {
    const nome = clienteNome[v.cliente_id] || "?";
    if (!scores[v.cliente_id]) scores[v.cliente_id] = { nome, totalVendas: 0, totalDevido: 0, parcelasAtrasadas: 0, parcelasTotal: 0, maiorAtraso: 0 };
    scores[v.cliente_id].totalVendas += Number(v.total);
    scores[v.cliente_id].totalDevido += Number(v.saldo_restante || 0);
  });

  const vendaCliente: Record<string, string> = {};
  (vendas || []).forEach(v => { vendaCliente[v.id] = v.cliente_id; });

  (parcelas || []).forEach(p => {
    const clienteId = vendaCliente[p.venda_id];
    if (!clienteId || !scores[clienteId]) return;
    scores[clienteId].parcelasTotal += 1;
    if (!p.pago && new Date(p.vencimento) < new Date()) {
      scores[clienteId].parcelasAtrasadas += 1;
      const dias = differenceInDays(new Date(), new Date(p.vencimento));
      if (dias > scores[clienteId].maiorAtraso) scores[clienteId].maiorAtraso = dias;
    }
  });

  const analysis = Object.entries(scores).map(([id, s]) => {
    const taxaAtraso = s.parcelasTotal > 0 ? (s.parcelasAtrasadas / s.parcelasTotal) * 100 : 0;
    let risco: "alto" | "medio" | "baixo" = "baixo";
    if (taxaAtraso > 40 || s.maiorAtraso > 30) risco = "alto";
    else if (taxaAtraso > 15 || s.maiorAtraso > 10) risco = "medio";
    return { id, ...s, taxaAtraso, risco };
  }).filter(a => a.totalDevido > 0 || a.parcelasAtrasadas > 0).sort((a, b) => {
    const order = { alto: 0, medio: 1, baixo: 2 };
    return order[a.risco] - order[b.risco] || b.totalDevido - a.totalDevido;
  });

  const altoRisco = analysis.filter(a => a.risco === "alto").length;
  const medioRisco = analysis.filter(a => a.risco === "medio").length;
  const exportId = "relatorio-inadimplencia-preditiva";

  const formatBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div id={exportId} className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          onExportPDF={() => exportToPDF(exportId, `Inadimplência Preditiva - ${factoryName}`)}
          onExportExcel={() => exportToExcel(analysis.map(a => ({
            Cliente: a.nome, "Total Devido": a.totalDevido, "Parcelas Atrasadas": a.parcelasAtrasadas,
            "Maior Atraso (dias)": a.maiorAtraso, "Taxa Atraso (%)": a.taxaAtraso.toFixed(1), Risco: a.risco,
          })), `Inadimplência Preditiva - ${factoryName}`)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Risco Alto" value={String(altoRisco)} icon={<ShieldAlert className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Risco Médio" value={String(medioRisco)} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
        <KpiCard title="Risco Baixo" value={String(analysis.length - altoRisco - medioRisco)} icon={<ShieldCheck className="h-4 w-4 text-green-500" />} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Score de Risco por Cliente</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Devido</TableHead>
                <TableHead className="text-right">Parcelas Atrasadas</TableHead>
                <TableHead className="text-right">Maior Atraso</TableHead>
                <TableHead>Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.slice(0, 50).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell className="text-right">{formatBRL(a.totalDevido)}</TableCell>
                  <TableCell className="text-right">{a.parcelasAtrasadas}/{a.parcelasTotal}</TableCell>
                  <TableCell className="text-right">{a.maiorAtraso > 0 ? `${a.maiorAtraso}d` : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={a.risco === "alto" ? "destructive" : a.risco === "medio" ? "outline" : "default"}>
                      {a.risco === "alto" ? "🔴 Alto" : a.risco === "medio" ? "🟡 Médio" : "🟢 Baixo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {analysis.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum cliente com risco identificado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
