import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Percent } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";

const formatBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function RelatorioComissoes() {
  const { factoryId, factoryName, branding } = useAuth();
  const [vendas, setVendas] = useState<any[]>([]);
  const [comissaoConfig, setComissaoConfig] = useState<number>(5);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { if (factoryId) load(); }, [factoryId]);
  useEffect(() => { setPreviewLoaded(false); }, [startDate, endDate]);

  async function load() {
    const [{ data: config }, { data: vd }] = await Promise.all([
      (supabase as any).from("comissoes_config").select("percentual").eq("factory_id", factoryId).limit(1),
      (supabase as any).from("vendas").select("id, total, operador, created_at").eq("factory_id", factoryId).neq("status", "cancelada").order("created_at", { ascending: false }),
    ]);
    if (config?.[0]) setComissaoConfig(Number(config[0].percentual));
    setVendas(vd || []);
  }

  const filtered = vendas.filter((v) => {
    const d = new Date(v.created_at);
    if (startDate && d < startDate) return false;
    if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
    return true;
  });

  const byVendedor: Record<string, { nome: string; totalVendas: number; qtdVendas: number }> = {};
  filtered.forEach((v) => {
    const nome = v.operador || "Não identificado";
    if (!byVendedor[nome]) byVendedor[nome] = { nome, totalVendas: 0, qtdVendas: 0 };
    byVendedor[nome].totalVendas += Number(v.total);
    byVendedor[nome].qtdVendas += 1;
  });

  const ranking = Object.values(byVendedor).sort((a, b) => b.totalVendas - a.totalVendas);
  const totalGeral = ranking.reduce((s, r) => s + r.totalVendas, 0);
  const totalComissao = totalGeral * (comissaoConfig / 100);
  const exportId = "relatorio-comissoes";

  function handlePreview() { setPreviewLoaded(true); }

  return (
    <div id={exportId} className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        <ExportButtons
          onPDF={() => exportToPDF(exportId, `Comissões - ${factoryName}`)}
          onExcel={() => exportToExcel(ranking.map(r => ({
            Vendedor: r.nome, Vendas: r.qtdVendas, "Total Vendido": r.totalVendas,
            "Comissão (%)": comissaoConfig, "Comissão (R$)": r.totalVendas * (comissaoConfig / 100),
          })), `Comissões - ${factoryName}`, "Comissões", "comissoes")}
          onPreview={handlePreview}
          previewLoaded={previewLoaded}
        />
      </div>

      {previewLoaded && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard title="Total Vendido" value={formatBRL(totalGeral)} icon={DollarSign} />
            <KpiCard title="Taxa de Comissão" value={`${comissaoConfig}%`} icon={Percent} />
            <KpiCard title="Total Comissões" value={formatBRL(totalComissao)} icon={DollarSign} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Comissão por Vendedor</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Total Vendido</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={r.nome}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right">{r.qtdVendas}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.totalVendas)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatBRL(r.totalVendas * (comissaoConfig / 100))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ranking.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma venda no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
