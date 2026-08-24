import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FileText, FileSpreadsheet, Printer, AlertTriangle, User, Wallet, Receipt, TrendingDown, MessageCircle, Send, CheckCircle2, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import DateRangeFilter from "@/components/relatorios/DateRangeFilter";
import KpiCard from "@/components/relatorios/KpiCard";

type Venda = {
  id: string;
  numero_pedido: number | null;
  created_at: string;
  status: string;
  status_entrega: string | null;
  forma_pagamento_tipo: string | null;
  data_vencimento: string | null;
  total: number;
  valor_original: number | null;
  valor_pago: number | null;
  cliente_id: string;
};

type Abatimento = {
  id: string;
  venda_id: string;
  valor: number;
  forma_pagamento: string | null;
  created_at: string;
};

type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  created_at: string;
  saldo_devedor_atual: number | null;
  status_financeiro: string | null;
};

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

/** Segunda-feira da semana corrente (referência do disparo semanal). */
function segundaDaSemana(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - diff);
  return d;
}
const semanaKey = (d = segundaDaSemana()) => d.toISOString().slice(0, 10);


export default function RelatorioFinanceiroCliente() {
  const { factoryId } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [abatimentos, setAbatimentos] = useState<Abatimento[]>([]);
  const [unidadesPorVenda, setUnidadesPorVenda] = useState<Record<string, number>>({});
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [situacaoFilter, setSituacaoFilter] = useState<string>("todos");
  const [searchInad, setSearchInad] = useState("");
  const [enviados, setEnviados] = useState<Record<string, boolean>>({});
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [previaAberta, setPreviaAberta] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const segunda = segundaDaSemana();
  const chaveSemana = `cobranca_confirmada_${factoryId || "sem-fabrica"}_${semanaKey(segunda)}`;

  // Confirmação é válida apenas para a semana corrente (reabre o dry-run toda segunda).
  useEffect(() => {
    try {
      setConfirmado(localStorage.getItem(chaveSemana) === "1");
    } catch {
      setConfirmado(false);
    }
  }, [chaveSemana]);

  function confirmarEnvio() {
    try { localStorage.setItem(chaveSemana, "1"); } catch { /* storage indisponível */ }
    setConfirmado(true);
  }

  function reabrirPrevia() {
    try { localStorage.removeItem(chaveSemana); } catch { /* storage indisponível */ }
    setConfirmado(false);
    setEnviados({});
  }

  useEffect(() => {
    if (!factoryId) return;
    (async () => {
      const [c, v, a] = await Promise.all([
        supabase.from("clientes").select("id,nome,telefone,created_at,saldo_devedor_atual,status_financeiro").eq("factory_id", factoryId).order("nome"),
        supabase.from("vendas").select("id,numero_pedido,created_at,status,status_entrega,forma_pagamento_tipo,data_vencimento,total,valor_original,valor_pago,cliente_id").eq("factory_id", factoryId).neq("status", "cancelada"),
        supabase.from("abatimentos_historico").select("id,venda_id,valor,forma_pagamento,created_at").eq("factory_id", factoryId),
      ]);
      setClientes((c.data as Cliente[]) || []);
      setVendas((v.data as Venda[]) || []);
      setAbatimentos((a.data as Abatimento[]) || []);
      const map: Record<string, number> = {};
      const vendaIds = ((v.data as Venda[]) || []).map((x) => x.id);
      for (let i = 0; i < vendaIds.length; i += 200) {
        const chunk = vendaIds.slice(i, i + 200);
        if (chunk.length === 0) continue;
        const { data: viData } = await supabase
          .from("venda_itens")
          .select("venda_id,quantidade")
          .in("venda_id", chunk);
        ((viData as { venda_id: string; quantidade: number }[]) || []).forEach((it) => {
          map[it.venda_id] = (map[it.venda_id] || 0) + Number(it.quantidade || 0);
        });
      }
      setUnidadesPorVenda(map);
    })();
  }, [factoryId]);

  const abatPorVenda = useMemo(() => {
    const m: Record<string, Abatimento[]> = {};
    abatimentos.forEach((a) => {
      (m[a.venda_id] ||= []).push(a);
    });
    return m;
  }, [abatimentos]);

  const cliente = clientes.find((c) => c.id === selectedClienteId);

  const vendasCliente = useMemo(() => {
    if (!selectedClienteId) return [];
    return vendas
      .filter((v) => v.cliente_id === selectedClienteId)
      .filter((v) => {
        const d = new Date(v.created_at);
        if (startDate && d < startDate) return false;
        if (endDate) {
          const e = new Date(endDate); e.setHours(23, 59, 59, 999);
          if (d > e) return false;
        }
        return true;
      })
      .map((v) => {
        const abats = abatPorVenda[v.id] || [];
        const pagoAbat = abats.reduce((s, a) => s + Number(a.valor || 0), 0);
        const valorAtual = Number(v.total ?? 0);
        // Salvaguarda: valor_original nunca pode ser menor que o total atual
        // (anomalia observada em vendas convertidas automaticamente de fiado).
        const valorOriginalBruto = Number(v.valor_original ?? v.total ?? 0);
        const valorOriginal = Math.max(valorOriginalBruto, valorAtual);
        const desconto = Math.max(0, valorOriginal - valorAtual);
        // Considera venda já paga (à vista / status paga) mesmo sem registro em abatimentos
        const pagoDireto = Number(v.valor_pago || 0);
        const quitadaPorStatus = v.status === "paga";
        const pago = Math.max(pagoAbat, pagoDireto, quitadaPorStatus ? valorAtual : 0);
        const saldo = quitadaPorStatus ? 0 : Math.max(0, valorAtual - pago);
        const unidades = unidadesPorVenda[v.id] || 0;
        return { ...v, abats, pago, valorOriginal, valorAtual, desconto, saldo, unidades };
      })
      .filter((v) => {
        if (statusFilter !== "todos" && v.status !== statusFilter) return false;
        if (situacaoFilter === "aberto" && v.saldo <= 0) return false;
        if (situacaoFilter === "pago" && v.saldo > 0) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [vendas, selectedClienteId, abatPorVenda, startDate, endDate, statusFilter, situacaoFilter, unidadesPorVenda]);

  const resumo = useMemo(() => {
    const totalComandas = vendasCliente.length;
    const totalVendido = vendasCliente.reduce((s, v) => s + v.valorAtual, 0);
    const totalOriginal = vendasCliente.reduce((s, v) => s + v.valorOriginal, 0);
    const totalPago = vendasCliente.reduce((s, v) => s + v.pago, 0);
    const totalDescontos = vendasCliente.reduce((s, v) => s + v.desconto, 0);
    const totalAbatimentos = totalPago;
    const saldoDevedor = vendasCliente.reduce((s, v) => s + v.saldo, 0);
    const comandasEmAberto = vendasCliente.filter((v) => v.saldo > 0).length;
    // validação: original - desconto - pago = saldo
    const consistente = Math.abs(totalOriginal - totalDescontos - totalPago - saldoDevedor) < 0.01;
    return { totalComandas, totalVendido, totalOriginal, totalPago, totalDescontos, totalAbatimentos, saldoDevedor, comandasEmAberto, consistente };
  }, [vendasCliente]);

  // Detalhamento por cliente com saldo pendente (usado na cobrança em massa)
  const inadimplentesDetalhado = useMemo(() => {
    const map: Record<string, { cliente: Cliente; saldo: number; abertas: number; comandas: { numero: string; data: string; venc: string | null; saldo: number }[] }> = {};
    vendas.forEach((v) => {
      if (v.status === "paga") return;
      const pagoAbat = (abatPorVenda[v.id] || []).reduce((s, a) => s + Number(a.valor || 0), 0);
      const pago = Math.max(pagoAbat, Number(v.valor_pago || 0));
      const saldo = Math.max(0, Number(v.total || 0) - pago);
      if (saldo <= 0) return;
      const c = clientes.find((x) => x.id === v.cliente_id);
      if (!c) return;
      if (!map[c.id]) map[c.id] = { cliente: c, saldo: 0, abertas: 0, comandas: [] };
      map[c.id].saldo += saldo;
      map[c.id].abertas += 1;
      map[c.id].comandas.push({
        numero: `#${v.numero_pedido ?? v.id.slice(0, 6)}`,
        data: dt(v.created_at),
        venc: v.data_vencimento,
        saldo,
      });
    });
    return Object.values(map)
      .map((x) => ({ ...x, comandas: x.comandas.sort((a, b) => a.numero.localeCompare(b.numero)) }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [vendas, abatPorVenda, clientes]);

  const inadimplentes = useMemo(
    () => inadimplentesDetalhado.filter((x) => !searchInad || x.cliente.nome.toLowerCase().includes(searchInad.toLowerCase())),
    [inadimplentesDetalhado, searchInad],
  );

  // ---------- Cobrança em massa ----------
  /** Itens que entram na rodada: seleção manual quando houver, senão todos os pendentes. */
  const previaItens = useMemo(() => {
    const marcados = inadimplentesDetalhado.filter((x) => selecionados[x.cliente.id]);
    return marcados.length > 0 ? marcados : inadimplentesDetalhado;
  }, [inadimplentesDetalhado, selecionados]);

  const semTelefone = useMemo(
    () => previaItens.filter((x) => !(x.cliente.telefone || "").replace(/\D/g, "")),
    [previaItens],
  );

  function buildMensagemCobranca(item: (typeof inadimplentesDetalhado)[number]) {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhas = [
      `Olá, ${item.cliente.nome}! 👋`,
      "",
      `Segue seu *resumo financeiro* atualizado em ${hoje}:`,
      "",
      ...item.comandas.map((c) => `• ${c.numero} — ${c.data}${c.venc ? ` (vence ${dt(c.venc)})` : ""}: ${brl(c.saldo)}`),
      "",
      `❗ *Saldo devedor total: ${brl(item.saldo)}* (${item.abertas} comanda(s) em aberto)`,
      "",
      "Qualquer dúvida estamos à disposição. Obrigado! 🙏",
    ];
    return linhas.join("\n");
  }

  function abrirWhatsApp(item: (typeof inadimplentesDetalhado)[number]) {
    // Dry-run: nada é aberto/enviado antes da confirmação da prévia semanal.
    if (!confirmado) return;
    const telefone = (item.cliente.telefone || "").replace(/\D/g, "");
    const base = telefone ? `https://wa.me/55${telefone}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(buildMensagemCobranca(item))}`, "_blank");
    setEnviados((p) => ({ ...p, [item.cliente.id]: true }));
  }

  function pdfCobranca(item: (typeof inadimplentesDetalhado)[number]) {
    exportToPDF(
      `Relatório Financeiro - ${item.cliente.nome}`,
      ["Comanda", "Data", "Vencimento", "Saldo"],
      item.comandas.map((c) => [c.numero, c.data, dt(c.venc), brl(c.saldo)]),
      `financeiro_${item.cliente.nome.replace(/\s+/g, "_")}`,
      [
        { label: "Comandas em aberto", value: String(item.abertas) },
        { label: "Saldo Devedor", value: brl(item.saldo) },
      ],
      undefined,
      undefined,
      [{ label: "(=) Saldo Devedor", value: brl(item.saldo) }],
    );
  }


  function buildRows() {
    const headers = ["Comanda", "Data", "Unid.", "Status", "Valor Original", "Desconto", "Abatimentos", "Saldo Devedor"];
    const rows = vendasCliente.map((v) => [
      `#${v.numero_pedido ?? v.id.slice(0, 6)}`,
      dt(v.created_at),
      String(v.unidades),
      v.saldo > 0 ? "Em aberto" : "Quitada",
      brl(v.valorOriginal),
      brl(v.desconto),
      brl(v.pago),
      brl(v.saldo),
    ]);
    return { headers, rows };
  }

  function handlePDF() {
    if (!cliente) return;
    const { headers, rows } = buildRows();
    const totalUnidades = vendasCliente.reduce((s, v) => s + v.unidades, 0);
    exportToPDF(
      `Relatório Financeiro - ${cliente.nome}`,
      headers,
      rows,
      `financeiro_${cliente.nome.replace(/\s+/g, "_")}`,
      [
        { label: "Comandas", value: String(resumo.totalComandas) },
        { label: "Unidades", value: String(totalUnidades) },
        { label: "Em Aberto", value: String(resumo.comandasEmAberto) },
        { label: "Total Vendido", value: brl(resumo.totalVendido) },
        { label: "Saldo Devedor", value: brl(resumo.saldoDevedor) },
      ],
      undefined,
      undefined,
      [
        { label: "Total Original", value: brl(resumo.totalOriginal) },
        { label: "(-) Descontos", value: brl(resumo.totalDescontos) },
        { label: "(-) Abatimentos/Pagamentos", value: brl(resumo.totalPago) },
        { label: "(=) Saldo Devedor", value: brl(resumo.saldoDevedor) },
      ],
    );
  }

  function handleExcel() {
    if (!cliente) return;
    const { headers, rows } = buildRows();
    exportToExcel(headers, rows, "Financeiro", `financeiro_${cliente.nome.replace(/\s+/g, "_")}`);
  }

  function handleWhatsApp() {
    if (!cliente) return;
    const telefone = (cliente.telefone || "").replace(/\D/g, "");
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhas = [
      `Olá, ${cliente.nome}! 👋`,
      "",
      `Segue o *Relatório Financeiro* atualizado em ${hoje}:`,
      "",
      `📄 Comandas: ${resumo.totalComandas}`,
      `🟡 Em aberto: ${resumo.comandasEmAberto}`,
      `💰 Total vendido: ${brl(resumo.totalVendido)}`,
      `✅ Total pago: ${brl(resumo.totalPago)}`,
      `🔻 Descontos: ${brl(resumo.totalDescontos)}`,
      `❗ *Saldo devedor: ${brl(resumo.saldoDevedor)}*`,
      "",
      "Qualquer dúvida estamos à disposição. Obrigado! 🙏",
    ];
    const msg = encodeURIComponent(linhas.join("\n"));
    const base = telefone ? `https://wa.me/55${telefone}` : "https://wa.me/";
    window.open(`${base}?text=${msg}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual" className="gap-2"><User className="h-4 w-4" /> Individual</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-2"><AlertTriangle className="h-4 w-4" /> Inadimplência</TabsTrigger>
          <TabsTrigger value="cobranca" className="gap-2"><Send className="h-4 w-4" /> Cobrança em Massa</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1 block">Cliente</Label>
                  <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
                    <SelectContent className="max-h-80">
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="paga">Paga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Situação</Label>
                  <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      <SelectItem value="aberto">Em aberto</SelectItem>
                      <SelectItem value="pago">Quitadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
            </CardContent>
          </Card>

          {cliente && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" /> {cliente.nome}
                    {cliente.status_financeiro === "inadimplente" && (
                      <Badge variant="destructive">Inadimplente</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div><span className="font-medium text-foreground">Telefone:</span> {cliente.telefone || "—"}</div>
                    <div><span className="font-medium text-foreground">Cadastrado em:</span> {dt(cliente.created_at)}</div>
                    <div><span className="font-medium text-foreground">Comandas em aberto:</span> {resumo.comandasEmAberto}</div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard title="Total Comandas" value={String(resumo.totalComandas)} icon={Receipt} />
                <KpiCard title="Total Vendido" value={brl(resumo.totalVendido)} icon={Wallet} />
                <KpiCard title="Total Pago" value={brl(resumo.totalPago)} icon={Wallet} subtitle={`Descontos: ${brl(resumo.totalDescontos)}`} />
                <KpiCard title="Saldo Devedor" value={brl(resumo.saldoDevedor)} icon={TrendingDown} />
              </div>

              {!resumo.consistente && (
                <div className="p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm flex gap-2 items-center">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Inconsistência detectada entre comandas, descontos, abatimentos e saldo devedor.
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={handlePDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
                <Button size="sm" variant="outline" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
                <Button size="sm" variant="outline" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleWhatsApp}><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Comanda</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-center">Unid.</TableHead>
                        <TableHead className="text-right">Original</TableHead>
                        <TableHead className="text-right">Desconto</TableHead>
                        <TableHead className="text-right">Pagamentos</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendasCliente.length === 0 && (
                        <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma comanda encontrada.</TableCell></TableRow>
                      )}
                      {vendasCliente.map((v) => (
                        <Fragment key={v.id}>
                          <TableRow>
                            <TableCell className="font-medium">#{v.numero_pedido ?? v.id.slice(0, 6)}</TableCell>
                            <TableCell>{dt(v.created_at)}</TableCell>
                            <TableCell>{dt(v.data_vencimento)}</TableCell>
                            <TableCell className="text-center">{v.unidades}</TableCell>
                            <TableCell className="text-right">{brl(v.valorOriginal)}</TableCell>
                            <TableCell className="text-right text-amber-600">{v.desconto > 0 ? `- ${brl(v.desconto)}` : "—"}</TableCell>
                            <TableCell className="text-right text-emerald-600">{v.pago > 0 ? `- ${brl(v.pago)}` : "—"}</TableCell>
                            <TableCell className="text-right font-bold">{brl(v.saldo)}</TableCell>
                            <TableCell>
                              {v.saldo > 0 ? <Badge variant="destructive">Em aberto</Badge> : <Badge>Quitada</Badge>}
                            </TableCell>
                          </TableRow>
                          {v.abats.length > 0 && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={9} className="text-xs">
                                <div className="pl-4 space-y-1">
                                  {v.abats.map((a) => (
                                    <div key={a.id} className="flex justify-between max-w-md">
                                      <span>↳ {dt(a.created_at)} — {a.forma_pagamento?.toUpperCase() || "PAGAMENTO"}</span>
                                      <span className="font-medium">{brl(Number(a.valor))}</span>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="inadimplencia" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Input placeholder="Buscar cliente..." value={searchInad} onChange={(e) => setSearchInad(e.target.value)} />
              <div className="text-sm text-muted-foreground">
                {inadimplentes.length} cliente(s) com saldo pendente — Total: <span className="font-bold text-foreground">{brl(inadimplentes.reduce((s, x) => s + x.saldo, 0))}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-center">Comandas em aberto</TableHead>
                    <TableHead className="text-right">Saldo Devedor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inadimplentes.map((x, i) => (
                    <TableRow key={x.cliente.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{x.cliente.nome}</TableCell>
                      <TableCell>{x.cliente.telefone || "—"}</TableCell>
                      <TableCell className="text-center">{x.abertas}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{brl(x.saldo)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelectedClienteId(x.cliente.id)}>Ver detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inadimplentes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum cliente inadimplente.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobranca" className="space-y-4">
          {/* Dry-run: prévia obrigatória da rodada semanal antes de liberar os envios */}
          <Card className={confirmado ? "border-emerald-600/50" : "border-amber-500/60"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {confirmado ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                Disparo da semana de {segunda.toLocaleDateString("pt-BR")}
                <Badge variant={confirmado ? "default" : "secondary"}>
                  {confirmado ? "Envio liberado" : "Prévia (dry-run)"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {confirmado
                  ? "Você já revisou e confirmou esta rodada. Os envios estão liberados até a próxima segunda-feira."
                  : "Revise abaixo os clientes e as mensagens que seriam enviadas. Nada é disparado enquanto você não confirmar."}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><div className="text-xs text-muted-foreground">Clientes na fila</div><div className="font-bold">{previaItens.length}</div></div>
                <div><div className="text-xs text-muted-foreground">Comandas em aberto</div><div className="font-bold">{previaItens.reduce((s, x) => s + x.abertas, 0)}</div></div>
                <div><div className="text-xs text-muted-foreground">Total a cobrar</div><div className="font-bold text-destructive">{brl(previaItens.reduce((s, x) => s + x.saldo, 0))}</div></div>
                <div><div className="text-xs text-muted-foreground">Sem telefone</div><div className="font-bold text-amber-600">{semTelefone.length}</div></div>
              </div>
              {semTelefone.length > 0 && (
                <div className="text-xs text-amber-600">
                  Sem telefone cadastrado: {semTelefone.map((x) => x.cliente.nome).join(", ")}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPreviaAberta((p) => !p)}>
                  {previaAberta ? "Ocultar mensagens" : "Ver mensagens da prévia"}
                </Button>
                {!confirmado ? (
                  <Button size="sm" onClick={confirmarEnvio} disabled={previaItens.length === 0}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar e liberar envio
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={reabrirPrevia}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Voltar para a prévia
                  </Button>
                )}
              </div>

              {previaAberta && (
                <div className="space-y-2 max-h-96 overflow-y-auto rounded-md border p-2">
                  {previaItens.map((x) => (
                    <div key={x.cliente.id} className="rounded-md bg-muted/40 p-2">
                      <div className="text-xs font-medium mb-1">
                        {x.cliente.nome} · {x.cliente.telefone || "sem telefone"}
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">{buildMensagemCobranca(x)}</pre>
                    </div>
                  ))}
                  {previaItens.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-4">Nenhuma pendência para esta semana.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm text-muted-foreground">
                Fila de cobrança semanal — {inadimplentesDetalhado.length} cliente(s) pendente(s), total{" "}
                <span className="font-bold text-foreground">{brl(inadimplentesDetalhado.reduce((s, x) => s + x.saldo, 0))}</span>.
                Marque os clientes e envie um a um; cada mensagem já vem pronta com as comandas em aberto.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelecionados(Object.fromEntries(inadimplentesDetalhado.map((x) => [x.cliente.id, true])))
                  }
                >
                  Selecionar todos
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelecionados({})}>Limpar seleção</Button>
                <Button size="sm" variant="outline" onClick={() => setEnviados({})}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Reiniciar fila
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    inadimplentesDetalhado.filter((x) => selecionados[x.cliente.id]).forEach(pdfCobranca)
                  }
                >
                  <FileText className="h-4 w-4 mr-1" /> Baixar PDFs selecionados
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Enviados nesta sessão: {Object.values(enviados).filter(Boolean).length} / {inadimplentesDetalhado.length}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {inadimplentesDetalhado.map((x) => (
              <Card key={x.cliente.id} className={enviados[x.cliente.id] ? "border-emerald-600/50" : undefined}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={!!selecionados[x.cliente.id]}
                      onCheckedChange={(c) => setSelecionados((p) => ({ ...p, [x.cliente.id]: !!c }))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        <span className="truncate">{x.cliente.nome}</span>
                        {enviados[x.cliente.id] && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {x.cliente.telefone || "sem telefone"} · {x.abertas} comanda(s)
                      </div>
                    </div>
                    <div className="text-right font-bold text-destructive whitespace-nowrap">{brl(x.saldo)}</div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5 pl-7">
                    {x.comandas.slice(0, 4).map((c) => (
                      <div key={c.numero} className="flex justify-between">
                        <span>{c.numero} — {c.data}</span>
                        <span>{brl(c.saldo)}</span>
                      </div>
                    ))}
                    {x.comandas.length > 4 && <div>+ {x.comandas.length - 4} comanda(s)…</div>}
                  </div>

                  <div className="flex flex-wrap gap-2 pl-7">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-primary-foreground hover:bg-emerald-700"
                      onClick={() => abrirWhatsApp(x)}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => pdfCobranca(x)}>
                      <FileText className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(buildMensagemCobranca(x))}
                    >
                      Copiar texto
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedClienteId(x.cliente.id)}>
                      Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {inadimplentesDetalhado.length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma pendência 🎉</CardContent></Card>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}