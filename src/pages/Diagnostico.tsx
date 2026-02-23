import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Database, Package, Factory, ShoppingCart } from "lucide-react";

export default function Diagnostico() {
  const [loading, setLoading] = useState(true);
  const [mesAno, setMesAno] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [estoque, setEstoque] = useState<any[]>([]);
  const [producaoSabor, setProducaoSabor] = useState<any[]>([]);
  const [vendasSabor, setVendasSabor] = useState<any[]>([]);
  const [resumoGeral, setResumoGeral] = useState({
    totalEstoque: 0,
    totalProduzido: 0,
    totalVendido: 0,
    totalFaturamento: 0,
  });

  useEffect(() => { loadAll(); }, [mesAno]);

  async function loadAll() {
    setLoading(true);
    try {
      const [year, month] = mesAno.split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const [gelosRes, producoesRes, vendasItensRes, vendasRes] = await Promise.all([
        (supabase as any).from("estoque_gelos").select("*, sabores(nome)"),
        (supabase as any).from("producoes").select("sabor_id, quantidade_total, sabores(nome)")
          .gte("created_at", startDate).lt("created_at", endDate),
        (supabase as any).from("venda_itens").select("sabor_id, quantidade, subtotal, sabores(nome), venda_id"),
        (supabase as any).from("vendas").select("id, total, status, created_at")
          .gte("created_at", startDate).lt("created_at", endDate),
      ]);

      // Estoque atual
      const gelos = (gelosRes.data || []).sort((a: any, b: any) => (b.quantidade || 0) - (a.quantidade || 0));
      setEstoque(gelos);

      // Produção por sabor no período
      const prodMap: Record<string, { nome: string; total: number }> = {};
      (producoesRes.data || []).forEach((p: any) => {
        if (!prodMap[p.sabor_id]) prodMap[p.sabor_id] = { nome: p.sabores?.nome || "?", total: 0 };
        prodMap[p.sabor_id].total += p.quantidade_total;
      });
      const prodList = Object.values(prodMap).sort((a, b) => b.total - a.total);
      setProducaoSabor(prodList);

      // Vendas no período - filtrar itens das vendas do período
      const vendasNoPeriodo = new Set((vendasRes.data || [])
        .filter((v: any) => v.status !== "cancelada")
        .map((v: any) => v.id));

      const vendaMap: Record<string, { nome: string; qtd: number; valor: number }> = {};
      (vendasItensRes.data || []).forEach((vi: any) => {
        if (!vendasNoPeriodo.has(vi.venda_id)) return;
        if (!vendaMap[vi.sabor_id]) vendaMap[vi.sabor_id] = { nome: vi.sabores?.nome || "?", qtd: 0, valor: 0 };
        vendaMap[vi.sabor_id].qtd += vi.quantidade;
        vendaMap[vi.sabor_id].valor += Number(vi.subtotal);
      });
      const vendaList = Object.values(vendaMap).sort((a, b) => b.qtd - a.qtd);
      setVendasSabor(vendaList);

      // Resumo
      setResumoGeral({
        totalEstoque: gelos.reduce((s: number, g: any) => s + (g.quantidade || 0), 0),
        totalProduzido: prodList.reduce((s, p) => s + p.total, 0),
        totalVendido: vendaList.reduce((s, v) => s + v.qtd, 0),
        totalFaturamento: (vendasRes.data || [])
          .filter((v: any) => v.status !== "cancelada")
          .reduce((s: number, v: any) => s + Number(v.total), 0),
      });
    } catch (e: any) {
      console.error("Diagnostico error:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Diagnóstico de Dados
        </h1>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="w-[160px] h-9"
          />
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando dados...</p>
      ) : (
        <>
          {/* Resumo geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Atual</p>
                  <p className="text-xl font-bold">{resumoGeral.totalEstoque.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Factory className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Produzido no Mês</p>
                  <p className="text-xl font-bold">{resumoGeral.totalProduzido.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Vendido no Mês</p>
                  <p className="text-xl font-bold">{resumoGeral.totalVendido.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="text-xl font-bold">R$ {resumoGeral.totalFaturamento.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Estoque atual */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" /> Estoque Atual por Sabor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sabor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estoque.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="text-sm">{g.sabores?.nome}</TableCell>
                        <TableCell className="text-right font-bold">{(g.quantidade || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 border-t-2">
                      <TableCell className="font-bold text-sm">TOTAL</TableCell>
                      <TableCell className="text-right font-extrabold">{resumoGeral.totalEstoque.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Produção no período */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Factory className="h-4 w-4" /> Produção por Sabor
                  <Badge variant="secondary" className="text-[10px] ml-auto">{resumoGeral.totalProduzido.toLocaleString()} un.</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sabor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {producaoSabor.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                    ) : producaoSabor.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{p.nome}</TableCell>
                        <TableCell className="text-right font-bold">{p.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {producaoSabor.length > 0 && (
                      <TableRow className="bg-muted/30 border-t-2">
                        <TableCell className="font-bold text-sm">TOTAL</TableCell>
                        <TableCell className="text-right font-extrabold">{resumoGeral.totalProduzido.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Vendas no período */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Vendas por Sabor
                  <Badge variant="secondary" className="text-[10px] ml-auto">R$ {resumoGeral.totalFaturamento.toFixed(2)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sabor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasSabor.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                    ) : vendasSabor.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{v.nome}</TableCell>
                        <TableCell className="text-right font-bold">{v.qtd.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">R$ {v.valor.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {vendasSabor.length > 0 && (
                      <TableRow className="bg-muted/30 border-t-2">
                        <TableCell className="font-bold text-sm">TOTAL</TableCell>
                        <TableCell className="text-right font-extrabold">{resumoGeral.totalVendido.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-extrabold">R$ {resumoGeral.totalFaturamento.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
