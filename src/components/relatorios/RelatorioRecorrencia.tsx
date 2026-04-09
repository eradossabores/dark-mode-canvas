import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShoppingCart, Calendar } from "lucide-react";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays } from "date-fns";

export default function RelatorioRecorrencia() {
  const { factoryId, factoryName } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);

  useEffect(() => { if (factoryId) load(); }, [factoryId]);

  async function load() {
    const [{ data: c }, { data: v }] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome, ultima_compra").eq("factory_id", factoryId).eq("status", "ativo"),
      (supabase as any).from("vendas").select("cliente_id, created_at").eq("factory_id", factoryId).neq("status", "cancelada").order("created_at"),
    ]);
    setClientes(c || []);
    setVendas(v || []);
  }

  const clienteMap: Record<string, { nome: string; compras: Date[]; ultimaCompra: Date | null }> = {};
  (clientes || []).forEach((c) => {
    clienteMap[c.id] = { nome: c.nome, compras: [], ultimaCompra: c.ultima_compra ? new Date(c.ultima_compra) : null };
  });
  (vendas || []).forEach((v) => {
    if (clienteMap[v.cliente_id]) clienteMap[v.cliente_id].compras.push(new Date(v.created_at));
  });

  const analysis = Object.entries(clienteMap).map(([id, c]) => {
    const compras = c.compras.sort((a, b) => a.getTime() - b.getTime());
    let freqMedia = 0;
    if (compras.length >= 2) {
      const diffs = compras.slice(1).map((d, i) => differenceInDays(d, compras[i]));
      freqMedia = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    }
    const diasDesdeUltima = c.ultimaCompra ? differenceInDays(new Date(), c.ultimaCompra) : 999;
    const status = compras.length < 2 ? "novo" : diasDesdeUltima > freqMedia * 1.5 ? "atrasado" : "regular";
    return { id, nome: c.nome, totalCompras: compras.length, freqMedia: Math.round(freqMedia), diasDesdeUltima, status };
  }).filter(c => c.totalCompras > 0).sort((a, b) => b.totalCompras - a.totalCompras);

  const regulares = analysis.filter(a => a.status === "regular").length;
  const atrasados = analysis.filter(a => a.status === "atrasado").length;
  const exportId = "relatorio-recorrencia";

  return (
    <div id={exportId} className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          onExportPDF={() => exportToPDF(exportId, `Recorrência - ${factoryName}`)}
          onExportExcel={() => exportToExcel(analysis.map(a => ({
            Cliente: a.nome, Compras: a.totalCompras, "Freq. Média (dias)": a.freqMedia,
            "Dias desde última": a.diasDesdeUltima, Status: a.status,
          })), `Recorrência - ${factoryName}`)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Clientes Regulares" value={String(regulares)} icon={<RefreshCw className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Reposição Atrasada" value={String(atrasados)} icon={<Calendar className="h-4 w-4 text-amber-500" />} />
        <KpiCard title="Total Analisados" value={String(analysis.length)} icon={<ShoppingCart className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Padrão de Recorrência</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Freq. Média</TableHead>
                <TableHead className="text-right">Dias s/ comprar</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.slice(0, 50).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell className="text-right">{a.totalCompras}</TableCell>
                  <TableCell className="text-right">{a.freqMedia > 0 ? `${a.freqMedia}d` : "-"}</TableCell>
                  <TableCell className="text-right">{a.diasDesdeUltima < 999 ? `${a.diasDesdeUltima}d` : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "regular" ? "default" : a.status === "atrasado" ? "destructive" : "secondary"}>
                      {a.status === "regular" ? "Regular" : a.status === "atrasado" ? "Atrasado" : "Novo"}
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
