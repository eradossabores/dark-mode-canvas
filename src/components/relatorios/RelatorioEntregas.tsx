import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Truck, Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type FretePagoPor = "cliente" | "empresa" | "ambos" | "todos";
type Agrupamento = "nenhum" | "dia" | "semana";

export default function RelatorioEntregas() {
  const { factoryId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FretePagoPor>("todos");
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("nenhum");
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [dtIni, setDtIni] = useState(primeiroDia);
  const [dtFim, setDtFim] = useState(ultimoDia);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [factoryId, dtIni, dtFim]);

  async function load() {
    if (!factoryId) return;
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("vendas")
        .select("id, numero_pedido, created_at, total, valor_frete, frete_pago_por, status_entrega, entregue_em, entregue_por, clientes(nome)")
        .eq("factory_id", factoryId)
        .gt("valor_frete", 0)
        .gte("created_at", `${dtIni}T00:00:00`)
        .lte("created_at", `${dtFim}T23:59:59`)
        .order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    if (filtro === "todos") return rows;
    return rows.filter((r) => (r.frete_pago_por || "cliente") === filtro);
  }, [rows, filtro]);

  function weekKey(d: Date) {
    // ISO-ish week: segunda a domingo
    const dt = new Date(d);
    const day = (dt.getDay() + 6) % 7; // 0 = seg
    dt.setDate(dt.getDate() - day);
    return dt.toISOString().slice(0, 10);
  }
  function groupLabel(iso: string) {
    const d = new Date(iso);
    if (agrupamento === "dia") return d.toLocaleDateString("pt-BR");
    const start = new Date(weekKey(d));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return `Semana ${start.toLocaleDateString("pt-BR")} → ${end.toLocaleDateString("pt-BR")}`;
  }
  const grouped = useMemo(() => {
    if (agrupamento === "nenhum") return null;
    const map = new Map<string, any[]>();
    for (const r of filtered) {
      const d = new Date(r.created_at);
      const key = agrupamento === "dia" ? d.toISOString().slice(0, 10) : weekKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({
        key,
        label: groupLabel(items[0].created_at),
        items,
        totalFrete: items.reduce((s, r) => s + Number(r.valor_frete || 0), 0),
        count: items.length,
      }));
  }, [filtered, agrupamento]);

  const totals = useMemo(() => {
    let cliente = 0, empresa = 0, ambos = 0, count = 0;
    for (const r of filtered) {
      const v = Number(r.valor_frete || 0);
      count += 1;
      const pagador = r.frete_pago_por || "cliente";
      if (pagador === "cliente") cliente += v;
      else if (pagador === "empresa") empresa += v;
      else if (pagador === "ambos") ambos += v;
    }
    return { cliente, empresa, ambos, total: cliente + empresa + ambos, count };
  }, [filtered]);

  function pagadorLabel(v: string) {
    if (v === "empresa") return "🏭 Empresa";
    if (v === "ambos") return "🤝 50/50";
    return "👤 Cliente";
  }
  function pagadorColor(v: string): "default" | "secondary" | "outline" {
    if (v === "empresa") return "destructive" as any;
    if (v === "ambos") return "secondary";
    return "default";
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório de Entregas (Frete)", 14, 14);
    doc.setFontSize(9);
    doc.text(`Período: ${dtIni} a ${dtFim}  |  Filtro: ${filtro}  |  Agrupamento: ${agrupamento}`, 14, 20);
    const body: any[] = [];
    if (grouped) {
      for (const g of grouped) {
        body.push([{ content: `${g.label} — ${g.count} entrega(s) — Frete R$ ${g.totalFrete.toFixed(2)}`, colSpan: 8, styles: { fillColor: [240, 240, 245], fontStyle: "bold" } }]);
        for (const r of g.items) {
          body.push([
            `#${r.numero_pedido || "-"}`,
            new Date(r.created_at).toLocaleDateString("pt-BR"),
            r.clientes?.nome || "-",
            `R$ ${Number(r.total || 0).toFixed(2)}`,
            `R$ ${Number(r.valor_frete || 0).toFixed(2)}`,
            pagadorLabel(r.frete_pago_por || "cliente"),
            r.entregue_por || "-",
            r.status_entrega || "-",
          ]);
        }
      }
    } else {
      for (const r of filtered) {
        body.push([
          `#${r.numero_pedido || "-"}`,
          new Date(r.created_at).toLocaleDateString("pt-BR"),
          r.clientes?.nome || "-",
          `R$ ${Number(r.total || 0).toFixed(2)}`,
          `R$ ${Number(r.valor_frete || 0).toFixed(2)}`,
          pagadorLabel(r.frete_pago_por || "cliente"),
          r.entregue_por || "-",
          r.status_entrega || "-",
        ]);
      }
    }
    autoTable(doc, {
      startY: 26,
      head: [["#", "Data", "Cliente", "Total", "Frete", "Pago por", "Entregador", "Status"]],
      body,
      styles: { fontSize: 8 },
    });
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(10);
    doc.text(`Total geral frete: R$ ${totals.total.toFixed(2)}`, 14, finalY);
    doc.text(`Pago pelo cliente: R$ ${totals.cliente.toFixed(2)}`, 14, finalY + 6);
    doc.text(`Pago pela empresa: R$ ${totals.empresa.toFixed(2)}`, 14, finalY + 12);
    doc.text(`Dividido (50/50): R$ ${totals.ambos.toFixed(2)}`, 14, finalY + 18);
    doc.save(`entregas_${dtIni}_${dtFim}.pdf`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Relatório de Entregas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><Label>De</Label><Input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} /></div>
          <div className="min-w-[200px]">
            <Label>Frete pago por</Label>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FretePagoPor)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="cliente">👤 Cliente</SelectItem>
                <SelectItem value="empresa">🏭 Empresa</SelectItem>
                <SelectItem value="ambos">🤝 50/50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label>Agrupar por</Label>
            <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem agrupamento</SelectItem>
                <SelectItem value="dia">Dia</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportPDF} variant="outline" className="ml-auto"><Download className="h-4 w-4 mr-1" /> Exportar PDF</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 bg-card">
            <div className="text-xs text-muted-foreground">Entregas</div>
            <div className="text-xl font-bold">{totals.count}</div>
          </div>
          <div className="rounded-lg border p-3 bg-emerald-500/10">
            <div className="text-xs text-muted-foreground">Frete pago cliente</div>
            <div className="text-xl font-bold text-emerald-700">R$ {totals.cliente.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border p-3 bg-red-500/10">
            <div className="text-xs text-muted-foreground">Frete pago empresa</div>
            <div className="text-xl font-bold text-red-700">R$ {totals.empresa.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border p-3 bg-amber-500/10">
            <div className="text-xs text-muted-foreground">50/50</div>
            <div className="text-xl font-bold text-amber-700">R$ {totals.ambos.toFixed(2)}</div>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Frete</TableHead>
                <TableHead>Pago por</TableHead>
                <TableHead>Entregador</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma entrega no período.</TableCell></TableRow>
              ) : grouped ? grouped.flatMap((g) => [
                <TableRow key={`h-${g.key}`} className="bg-muted/50">
                  <TableCell colSpan={8} className="font-semibold text-sm">
                    {g.label} · {g.count} entrega(s) · Frete <span className="text-primary">R$ {g.totalFrete.toFixed(2)}</span>
                  </TableCell>
                </TableRow>,
                ...g.items.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-primary">#{r.numero_pedido || "-"}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{r.clientes?.nome || "-"}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.total || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">R$ {Number(r.valor_frete || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={pagadorColor(r.frete_pago_por || "cliente")}>{pagadorLabel(r.frete_pago_por || "cliente")}</Badge></TableCell>
                    <TableCell className="text-xs">{r.entregue_por || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.status_entrega || "-"}</TableCell>
                  </TableRow>
                )),
              ]) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-bold text-primary">#{r.numero_pedido || "-"}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{r.clientes?.nome || "-"}</TableCell>
                  <TableCell className="text-right">R$ {Number(r.total || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">R$ {Number(r.valor_frete || 0).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={pagadorColor(r.frete_pago_por || "cliente")}>{pagadorLabel(r.frete_pago_por || "cliente")}</Badge></TableCell>
                  <TableCell className="text-xs">{r.entregue_por || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.status_entrega || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}