import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, RefreshCw, CalendarIcon } from "lucide-react";

interface SaborInfo {
  id: string;
  nome: string;
}

interface ProducaoResumo {
  data: string; // YYYY-MM-DD
  dataFormatada: string;
  sabores: Record<string, number>; // sabor_id -> quantidade
}

export default function ConciliacaoProducao() {
  const [sabores, setSabores] = useState<SaborInfo[]>([]);
  const [producoesSistema, setProducoesSistema] = useState<ProducaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesAno, setMesAno] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Totals by flavor from system
  const [totaisSistema, setTotaisSistema] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [mesAno]);

  async function loadData() {
    setLoading(true);
    try {
      const [year, month] = mesAno.split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const [saboresRes, producoesRes] = await Promise.all([
        (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome"),
        (supabase as any)
          .from("producoes")
          .select("id, sabor_id, quantidade_total, created_at, sabores(nome)")
          .gte("created_at", startDate)
          .lt("created_at", endDate)
          .order("created_at"),
      ]);

      const sabs: SaborInfo[] = saboresRes.data || [];
      setSabores(sabs);

      const prods: any[] = producoesRes.data || [];

      // Group by date
      const byDate: Record<string, Record<string, number>> = {};
      const totals: Record<string, number> = {};

      prods.forEach((p: any) => {
        const dateKey = p.created_at.split("T")[0];
        if (!byDate[dateKey]) byDate[dateKey] = {};
        byDate[dateKey][p.sabor_id] = (byDate[dateKey][p.sabor_id] || 0) + p.quantidade_total;
        totals[p.sabor_id] = (totals[p.sabor_id] || 0) + p.quantidade_total;
      });

      // Build all dates in month
      const daysInMonth = new Date(year, month, 0).getDate();
      const resumos: ProducaoResumo[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dateFormatada = `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
        if (byDate[dateStr] || new Date(dateStr) <= new Date()) {
          resumos.push({
            data: dateStr,
            dataFormatada: dateFormatada,
            sabores: byDate[dateStr] || {},
          });
        }
      }

      setProducoesSistema(resumos);
      setTotaisSistema(totals);
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Filter sabores that have at least some production
  const saboresAtivos = sabores.filter(
    (s) => producoesSistema.some((p) => (p.sabores[s.id] || 0) > 0)
  );

  const totalGeral = Object.values(totaisSistema).reduce((s, v) => s + v, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Conciliação de Produção
          </CardTitle>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="w-[160px] h-8 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Dados de produção registrados no sistema para o período selecionado. Compare com sua planilha.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : (
          <>
            {/* Totals by flavor */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Total no Período — Sistema
                <Badge variant="secondary" className="ml-2 text-[10px]">{totalGeral.toLocaleString()} un.</Badge>
              </p>
              <div className="flex flex-wrap gap-2">
                {saboresAtivos.map((s) => (
                  <div key={s.id} className="text-xs bg-background border rounded px-2 py-1">
                    <span className="font-medium">{s.nome}:</span>{" "}
                    <span className="font-bold">{(totaisSistema[s.id] || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily breakdown table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[90px]">Data</TableHead>
                    {saboresAtivos.map((s) => (
                      <TableHead key={s.id} className="text-center min-w-[80px] text-xs">
                        {s.nome}
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[70px] text-xs font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {producoesSistema
                    .filter((p) => Object.keys(p.sabores).length > 0)
                    .map((p) => {
                      const totalDia = Object.values(p.sabores).reduce((s, v) => s + v, 0);
                      return (
                        <TableRow key={p.data}>
                          <TableCell className="sticky left-0 bg-background z-10 text-xs font-medium">
                            {p.dataFormatada}
                          </TableCell>
                          {saboresAtivos.map((s) => {
                            const val = p.sabores[s.id] || 0;
                            return (
                              <TableCell key={s.id} className="text-center text-sm">
                                {val > 0 ? (
                                  <span className="font-semibold">{val}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center text-sm font-bold">{totalDia}</TableCell>
                        </TableRow>
                      );
                    })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/30 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-muted/30 z-10 text-xs">TOTAL</TableCell>
                    {saboresAtivos.map((s) => (
                      <TableCell key={s.id} className="text-center text-sm font-bold">
                        {(totaisSistema[s.id] || 0).toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-sm font-extrabold">
                      {totalGeral.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {producoesSistema.filter((p) => Object.keys(p.sabores).length > 0).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma produção registrada neste período.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
