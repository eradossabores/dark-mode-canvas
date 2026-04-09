import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, Target, Truck, CreditCard } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(200,98%,39%)", "hsl(213,93%,67%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)", "hsl(215,20%,65%)", "hsl(0,72%,50%)"];

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão", fiado: "A Prazo",
  boleto: "Boleto", parcelado: "Parcelado", especie: "Espécie",
};
const displayFormaPagamento = (v: string | null) => v ? (FORMA_PAGAMENTO_LABELS[v] || v.charAt(0).toUpperCase() + v.slice(1)) : "-";

const FORMAS_PAGAMENTO = [
  { value: "todos", label: "Todos" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "fiado", label: "A Prazo" },
  { value: "boleto", label: "Boleto" },
];

const STATUS_VENDA = [
  { value: "todos", label: "Todos" },
  { value: "paga", label: "Paga" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelada", label: "Cancelada" },
];

export default function RelatorioVendas() {
  const { factoryId, factoryName, branding } = useAuth();
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [abatimentos, setAbatimentos] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [filtroPagamento, setFiltroPagamento] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroOperador, setFiltroOperador] = useState("todos");
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { loadData(); }, [factoryId]);

  useEffect(() => { setPreviewLoaded(false); }, [startDate, endDate, filtroPagamento, filtroStatus, filtroCliente, filtroOperador]);

  async function loadData() {
    let vQ = (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false });
    let iQ = (supabase as any).from("venda_itens").select("*, sabores(nome)");
    if (factoryId) { vQ = vQ.eq("factory_id", factoryId); iQ = iQ.eq("factory_id", factoryId); }
    const [v, it] = await Promise.all([vQ, iQ]);
    const vendasData = v.data || [];
    setVendas(vendasData);
    setItens(it.data || []);

    // Buscar abatimentos pelas vendas (não por factory_id, pois pode ser null)
    if (vendasData.length > 0) {
      const vendaIds = vendasData.map((vd: any) => vd.id);
      const { data: abData } = await (supabase as any)
        .from("abatimentos_historico")
        .select("*")
        .in("venda_id", vendaIds);
      setAbatimentos(abData || []);
    } else {
      setAbatimentos([]);
    }
  }

  const operadores = useMemo(() => {
    const set = new Set(vendas.map(v => v.operador).filter(Boolean));
    return Array.from(set).sort();
  }, [vendas]);

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const d = new Date(v.created_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > new Date(endDate.getTime() + 86400000)) return false;
      if (filtroPagamento !== "todos" && v.forma_pagamento !== filtroPagamento) return false;
      if (filtroStatus !== "todos" && v.status !== filtroStatus) return false;
      if (filtroCliente.trim() && !(v.clientes?.nome || "").toLowerCase().includes(filtroCliente.toLowerCase())) return false;
      if (filtroOperador !== "todos" && v.operador !== filtroOperador) return false;
      return true;
    });
  }, [vendas, startDate, endDate, filtroPagamento, filtroStatus, filtroCliente, filtroOperador]);

  const filteredIds = new Set(filtered.map((v) => v.id));
  const filteredItens = itens.filter((i) => filteredIds.has(i.venda_id));
  const filteredAbatimentos = abatimentos.filter((a) => filteredIds.has(a.venda_id));

  const abatimentosPorVenda = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAbatimentos.forEach((a) => {
      map[a.venda_id] = (map[a.venda_id] || 0) + Number(a.valor);
    });
    return map;
  }, [filteredAbatimentos]);

  const faturamento = filtered.reduce((s, v) => s + Number(v.total), 0);
  const totalFrete = filtered.reduce((s, v) => s + Number(v.valor_frete || 0), 0);
  const totalVendas = filtered.length;
  const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
  const totalUnidades = filteredItens.reduce((s, i) => s + i.quantidade, 0);
  const totalAbatido = filteredAbatimentos.reduce((s, a) => s + Number(a.valor), 0);

  // Total recebido = vendas pagas (total integral) + abatimentos em vendas não-pagas
  const totalRecebido = filtered.reduce((s, v) => {
    if (v.status === "paga") return s + Number(v.total);
    return s + (abatimentosPorVenda[v.id] || 0);
  }, 0);
  const saldoPendente = faturamento - totalRecebido;

  const porSabor = useMemo(() => {
    const map: Record<string, { qtd: number; valor: number }> = {};
    filteredItens.forEach((i) => {
      const nome = i.sabores?.nome || "?";
      if (!map[nome]) map[nome] = { qtd: 0, valor: 0 };
      map[nome].qtd += i.quantidade;
      map[nome].valor += Number(i.subtotal);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, qtd: v.qtd, valor: v.valor }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [filteredItens]);

  // Faturamento por forma de pagamento
  const porFormaPagamento = useMemo(() => {
    const map: Record<string, { qtd: number; valor: number }> = {};
    filtered.forEach((v) => {
      const forma = v.forma_pagamento || "outro";
      if (!map[forma]) map[forma] = { qtd: 0, valor: 0 };
      map[forma].qtd += 1;
      map[forma].valor += Number(v.total);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name: displayFormaPagamento(name), qtd: v.qtd, valor: v.valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  const faturamentoPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((v) => {
      const day = new Date(v.created_at).toLocaleDateString("pt-BR");
      map[day] = (map[day] || 0) + Number(v.total);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).reverse();
  }, [filtered]);

  const headers = ["Data", "Cliente", "Total", "Abatido", "Saldo", "Frete", "Pagamento", "Status", "Operador"];
  const saldoTotal = faturamento - totalAbatido;
  const rows = [
    ...filtered.map((v) => {
      const abatido = abatimentosPorVenda[v.id] || 0;
      const saldo = Number(v.total) - abatido;
      return [
        new Date(v.created_at).toLocaleDateString("pt-BR"),
        v.clientes?.nome || "-",
        `R$ ${Number(v.total).toFixed(2)}`,
        abatido > 0 ? `R$ ${abatido.toFixed(2)}` : "-",
        saldo > 0.01 ? `R$ ${saldo.toFixed(2)}` : "Quitado",
        Number(v.valor_frete || 0) > 0 ? `R$ ${Number(v.valor_frete).toFixed(2)} (${v.frete_pago_por || "cliente"})` : "-",
        displayFormaPagamento(v.forma_pagamento),
        v.status,
        v.operador,
      ];
    }),
    [
      "",
      "TOTAIS:",
      `R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      saldoTotal <= 0.01 ? "Quitado" : `R$ ${saldoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "",
      "",
      "",
    ],
  ];

  const periodoLabel = `${startDate?.toLocaleDateString("pt-BR") || "—"} a ${endDate?.toLocaleDateString("pt-BR") || "—"}`;

  return (
    <div className="space-y-6">
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <div>
          <Label className="text-xs mb-1 block">Pagamento</Label>
          <Select value={filtroPagamento} onValueChange={setFiltroPagamento}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_VENDA.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Operador</Label>
          <Select value={filtroOperador} onValueChange={setFiltroOperador}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {operadores.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Cliente</Label>
          <Input placeholder="Buscar cliente..." value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} className="w-[160px]" />
        </div>
        <ExportButtons
          onPreview={() => setPreviewLoaded(true)}
          previewLoaded={previewLoaded}
          onPDF={() => exportToPDF("Relatório de Vendas", headers, rows, "relatorio-vendas", [
            { label: "Faturamento Total", value: `R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total de Vendas", value: totalVendas.toString() },
            { label: "Ticket Médio", value: `R$ ${ticketMedio.toFixed(2)}` },
            { label: "Unidades Vendidas", value: totalUnidades.toLocaleString("pt-BR") },
            { label: "Total Abatido", value: `R$ ${totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total Frete", value: `R$ ${totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Período", value: periodoLabel },
            ...(filtroPagamento !== "todos" ? [{ label: "Filtro Pagamento", value: filtroPagamento.toUpperCase() }] : []),
            ...(filtroStatus !== "todos" ? [{ label: "Filtro Status", value: filtroStatus }] : []),
          ], "charts-vendas", { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl }, [
            { label: "Faturamento Total", value: `R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total Abatido", value: `R$ ${totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Pendência", value: saldoTotal <= 0.01 ? "Quitado" : `R$ ${saldoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
          ])}
          onExcel={() => exportToExcel(headers, rows, "Vendas", "relatorio-vendas")}
        />
      </DateRangeFilter>

      {!previewLoaded ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Selecione os filtros e clique em "Visualizar Relatório"</p>
            <p className="text-sm mt-1">A pré-visualização será exibida aqui.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">Não há vendas no período de {periodoLabel} com os filtros selecionados.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground font-medium">
            Período: {periodoLabel}
            {filtroPagamento !== "todos" && <Badge variant="outline" className="ml-2">{filtroPagamento.toUpperCase()}</Badge>}
            {filtroStatus !== "todos" && <Badge variant="outline" className="ml-2">{filtroStatus}</Badge>}
            {filtroCliente.trim() && <Badge variant="outline" className="ml-2">Cliente: {filtroCliente}</Badge>}
            {filtroOperador !== "todos" && <Badge variant="outline" className="ml-2">Op: {filtroOperador}</Badge>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Faturamento" value={`R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
            <KpiCard title="Total Recebido" value={`R$ ${totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CreditCard} />
            <KpiCard title="Saldo Pendente" value={`R$ ${saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Target} />
            <KpiCard title="Total de Vendas" value={totalVendas.toString()} icon={ShoppingCart} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Ticket Médio" value={`R$ ${ticketMedio.toFixed(2)}`} icon={TrendingUp} />
            <KpiCard title="Unidades Vendidas" value={totalUnidades.toLocaleString("pt-BR")} icon={ShoppingCart} />
            <KpiCard title="Total Abatido" value={`R$ ${totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CreditCard} />
            <KpiCard title="Total Frete" value={`R$ ${totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Truck} />
          </div>

          <div id="charts-vendas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Ranking - Mais Vendidos</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={porSabor.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Qtd Vendida" fill="hsl(200,98%,39%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Faturamento por Sabor</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={porSabor.slice(0, 6)} dataKey="valor" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {porSabor.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card data-chart-export>
              <CardHeader><CardTitle className="text-sm">Por Forma de Pagamento</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={porFormaPagamento} dataKey="valor" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {porFormaPagamento.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card id="chart-vendas-linha" data-chart-export>
            <CardHeader><CardTitle className="text-sm">Faturamento por Dia</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={faturamentoPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Line type="monotone" dataKey="value" name="Faturamento" stroke="hsl(200,98%,39%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de Vendas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map((v) => {
                    const abatido = abatimentosPorVenda[v.id] || 0;
                    const saldo = Number(v.total) - abatido;
                    return (
                      <TableRow key={v.id}>
                        <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{v.clientes?.nome}</TableCell>
                        <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                        <TableCell>
                          {abatido > 0
                            ? <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">R$ {abatido.toFixed(2)}</span>
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {abatido > 0
                            ? <Badge variant={saldo <= 0.01 ? "default" : "secondary"}>{saldo <= 0.01 ? "Quitado" : `R$ ${saldo.toFixed(2)}`}</Badge>
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {Number(v.valor_frete || 0) > 0 
                            ? <span className="text-xs">R$ {Number(v.valor_frete).toFixed(2)} <span className="text-muted-foreground">({v.frete_pago_por || "cliente"})</span></span>
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{displayFormaPagamento(v.forma_pagamento)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"}>{v.status}</Badge>
                        </TableCell>
                        <TableCell>{v.operador}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <tr className="border-t-2 border-primary/30 bg-muted/50 font-bold">
                    <TableCell colSpan={2} className="text-right text-sm">Totais:</TableCell>
                    <TableCell className="text-sm">R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-emerald-600 dark:text-emerald-400">R$ {totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant={(faturamento - totalAbatido) <= 0.01 ? "default" : "secondary"}>
                        {(faturamento - totalAbatido) <= 0.01 ? "Quitado" : `R$ ${(faturamento - totalAbatido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">R$ {totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </tr>
                </tfoot>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
