import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, Target, Truck, CreditCard, Package, Wine } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import ExportButtons from "./ExportButtons";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { useAuth } from "@/contexts/AuthContext";
import { analisarComposicaoVendas } from "./relatorio-vendas-analysis";

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
  const [bebidaItens, setBebidaItens] = useState<any[]>([]);
  const [cuboItens, setCuboItens] = useState<any[]>([]);
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
    if (factoryId) vQ = vQ.eq("factory_id", factoryId);
    const v = await vQ;
    const vendasData = v.data || [];
    setVendas(vendasData);

    if (vendasData.length > 0) {
      const vendaIds = vendasData.map((vd: any) => vd.id);
      const chunks: string[][] = [];
      for (let index = 0; index < vendaIds.length; index += 200) chunks.push(vendaIds.slice(index, index + 200));
      const resultados = await Promise.all(chunks.map(async (ids) => {
        const [gelos, bebidas, cubos, abats] = await Promise.all([
          (supabase as any).from("venda_itens").select("*, sabores(nome)").in("venda_id", ids),
          (supabase as any).from("venda_bebida_itens").select("venda_id,quantidade,subtotal,tipo_venda,bebidas(unidades_fardo)").in("venda_id", ids),
          (supabase as any).from("venda_gelo_cubo_itens").select("venda_id,quantidade,subtotal").in("venda_id", ids),
          (supabase as any).from("abatimentos_historico").select("*").in("venda_id", ids),
        ]);
        return { gelos, bebidas, cubos, abats };
      }));
      setItens(resultados.flatMap(({ gelos }) => gelos.data || []));
      setBebidaItens(resultados.flatMap(({ bebidas }) => bebidas.data || []));
      setCuboItens(resultados.flatMap(({ cubos }) => cubos.data || []));
      setAbatimentos(resultados.flatMap(({ abats }) => abats.data || []));
    } else {
      setItens([]);
      setBebidaItens([]);
      setCuboItens([]);
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
  const filteredBebidaItens = bebidaItens.filter((i) => filteredIds.has(i.venda_id));
  const filteredCuboItens = cuboItens.filter((i) => filteredIds.has(i.venda_id));
  const filteredAbatimentos = abatimentos.filter((a) => filteredIds.has(a.venda_id));

  const composicao = useMemo(
    () => analisarComposicaoVendas(filtered, filteredItens, filteredBebidaItens, filteredCuboItens),
    [filtered, filteredItens, filteredBebidaItens, filteredCuboItens],
  );

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
  const totalUnidades = composicao.gelosSaborizados;
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

  const headers = ["Data", "Comanda", "Cliente", "Gelos Saborizados", "Preço Médio Gelo", "Bebidas", "Gelo em Cubo", "Valor dos Produtos", "Frete/Ajustes", "Total da Nota", "Recebido", "Saldo", "Pagamento", "Status", "Operador"];
  const rows = [
    ...filtered.map((v) => {
      const abatido = abatimentosPorVenda[v.id] || 0;
      const recebido = v.status === "paga" ? Number(v.total) : abatido;
      const saldo = Number(v.total) - recebido;
      const detalhe = composicao.porVenda.get(v.id);
      return [
        new Date(v.created_at).toLocaleDateString("pt-BR"),
        v.numero_pedido ? `#${v.numero_pedido}` : "-",
        v.clientes?.nome || "-",
        detalhe?.gelosSaborizados || "-",
        detalhe?.gelosSaborizados ? `R$ ${detalhe.precoMedioGelosSaborizados.toFixed(2)}` : "-",
        detalhe?.bebidasUnidadesReais || "-",
        detalhe?.geloCuboPacotes || "-",
        `R$ ${Number(detalhe?.subtotalProdutos || 0).toFixed(2)}`,
        `R$ ${Number((detalhe?.frete || 0) + (detalhe?.ajustes || 0)).toFixed(2)}`,
        `R$ ${Number(v.total).toFixed(2)}`,
        recebido > 0 ? `R$ ${recebido.toFixed(2)}` : "-",
        saldo > 0.01 ? `R$ ${saldo.toFixed(2)}` : "Quitado",
        displayFormaPagamento(v.forma_pagamento),
        v.status,
        v.operador,
      ];
    }),
    [
      "",
      "",
      "TOTAIS:",
      totalUnidades.toLocaleString("pt-BR"),
      totalUnidades > 0 ? `R$ ${composicao.precoMedioGelosSaborizados.toFixed(2)}` : "-",
      composicao.bebidasUnidadesReais.toLocaleString("pt-BR"),
      composicao.geloCuboPacotes.toLocaleString("pt-BR"),
      `R$ ${composicao.subtotalProdutos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(composicao.frete + composicao.ajustes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      saldoPendente <= 0.01 ? "Quitado" : `R$ ${saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
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
            { label: "Gelos Saborizados", value: totalUnidades.toLocaleString("pt-BR") },
            { label: "Valor dos Gelos", value: `R$ ${composicao.valorGelosSaborizados.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Preço Médio dos Gelos", value: `R$ ${composicao.precoMedioGelosSaborizados.toFixed(2)}` },
            { label: "Bebidas (unidades reais)", value: composicao.bebidasUnidadesReais.toLocaleString("pt-BR") },
            { label: "Valor das Bebidas", value: `R$ ${composicao.valorBebidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total Abatido", value: `R$ ${totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total Frete", value: `R$ ${totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Período", value: periodoLabel },
            ...(filtroPagamento !== "todos" ? [{ label: "Filtro Pagamento", value: filtroPagamento.toUpperCase() }] : []),
            ...(filtroStatus !== "todos" ? [{ label: "Filtro Status", value: filtroStatus }] : []),
          ], undefined, { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl }, [
            { label: "Faturamento Total", value: `R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Total Recebido", value: `R$ ${totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
            { label: "Pendência", value: saldoPendente <= 0.01 ? "Quitado" : `R$ ${saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
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
            <KpiCard title="Gelos Saborizados" value={totalUnidades.toLocaleString("pt-BR")} icon={Package} subtitle={`${`R$ ${composicao.valorGelosSaborizados.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} · média R$ ${composicao.precoMedioGelosSaborizados.toFixed(2)}/un`} />
            <KpiCard title="Total Abatido" value={`R$ ${totalAbatido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CreditCard} />
            <KpiCard title="Total Frete" value={`R$ ${totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Truck} />
          </div>

          {(composicao.bebidasUnidadesReais > 0 || composicao.geloCuboPacotes > 0 || Math.abs(composicao.ajustes) > 0.01) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard title="Bebidas" value={`${composicao.bebidasUnidadesReais.toLocaleString("pt-BR")} un`} icon={Wine} subtitle={`${composicao.bebidasVolumes.toLocaleString("pt-BR")} volume(s) · R$ ${composicao.valorBebidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              <KpiCard title="Gelo em Cubo" value={`${composicao.geloCuboPacotes.toLocaleString("pt-BR")} pacote(s)`} icon={Package} subtitle={`R$ ${composicao.valorGeloCubo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              <KpiCard title="Frete e Ajustes" value={`R$ ${(composicao.frete + composicao.ajustes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Truck} subtitle="Diferença até o total das notas" />
            </div>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Histórico de Vendas</CardTitle>
                <Badge variant="outline" className="text-xs font-normal">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-[100px]">Data</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Comanda</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Gelos</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Média/un</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Outros produtos</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Produtos</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Total</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Recebido</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Saldo</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Frete</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Pagamento</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map((v) => {
                    const abatido = abatimentosPorVenda[v.id] || 0;
                    const recebido = v.status === "paga" ? Number(v.total) : abatido;
                    const saldo = Number(v.total) - recebido;
                    const detalhe = composicao.porVenda.get(v.id);
                    const outrosProdutos = [
                      detalhe?.bebidasUnidadesReais ? `${detalhe.bebidasUnidadesReais} bebida(s)` : "",
                      detalhe?.geloCuboPacotes ? `${detalhe.geloCuboPacotes} cubo(s)` : "",
                    ].filter(Boolean).join(" · ") || "—";
                    return (
                      <TableRow key={v.id} className="transition-colors">
                        <TableCell className="text-sm tabular-nums">{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-sm font-medium">{v.numero_pedido ? `#${v.numero_pedido}` : "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{v.clientes?.nome || "-"}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{detalhe?.gelosSaborizados.toLocaleString("pt-BR") || "—"}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{detalhe?.gelosSaborizados ? `R$ ${detalhe.precoMedioGelosSaborizados.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{outrosProdutos}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">R$ {Number(detalhe?.subtotalProdutos || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-sm font-semibold text-right tabular-nums">R$ {Number(v.total).toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {recebido > 0
                            ? <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">R$ {recebido.toFixed(2)}</span>
                            : <span className="text-sm text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {saldo <= 0.01 
                            ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">Quitado</Badge>
                            : <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs font-semibold tabular-nums">R$ {saldo.toFixed(2)}</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(v.valor_frete || 0) > 0 
                            ? <span className="text-sm">R$ {Number(v.valor_frete).toFixed(2)}</span>
                            : <span className="text-sm text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs font-normal">{displayFormaPagamento(v.forma_pagamento)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            className={
                              v.status === "paga" 
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs" 
                                : v.status === "cancelada" 
                                  ? "bg-destructive/10 text-destructive border-0 text-xs" 
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs"
                            }
                          >
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.operador}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <tr className="border-t-2 border-primary/20 bg-primary/5">
                    <TableCell colSpan={3} className="text-right text-sm font-bold py-3">Totais:</TableCell>
                    <TableCell className="text-sm font-bold text-right tabular-nums py-3">{totalUnidades.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm font-bold text-right tabular-nums py-3">R$ {composicao.precoMedioGelosSaborizados.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3">{composicao.bebidasUnidadesReais > 0 ? `${composicao.bebidasUnidadesReais} bebida(s)` : "—"}</TableCell>
                    <TableCell className="text-sm font-bold text-right tabular-nums py-3">R$ {composicao.subtotalProdutos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm font-bold text-right tabular-nums py-3">R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm font-bold text-right tabular-nums text-emerald-600 dark:text-emerald-400 py-3">R$ {totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center py-3">
                      {saldoPendente <= 0.01 
                        ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs font-bold">R$ 0,00</Badge>
                        : <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs font-bold tabular-nums">R$ {saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm font-bold text-right tabular-nums py-3">R$ {totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell colSpan={3} className="py-3"></TableCell>
                  </tr>
                </tfoot>
              </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
