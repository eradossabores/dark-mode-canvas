import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Gift, Medal, Package, Share2, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import KpiCard from "./KpiCard";
import RelatorioMensalClienteCharts from "./RelatorioMensalClienteCharts";
import { analisarComprasMensais, ItemMensalRaw, PRECO_REFERENCIA_GELO } from "./relatorio-mensal-cliente-analysis";
import { exportToPDF } from "@/lib/export-utils";

interface ClienteMensal { id: string; nome: string; telefone: string | null }

const brl = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

function periodoMensal(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes || mes < 1 || mes > 12) throw new Error("Competência inválida");
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01T00:00:00-03:00`;
  const fim = `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01T00:00:00-03:00`;
  const label = new Date(`${ano}-${String(mes).padStart(2, "0")}-15T12:00:00-03:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { inicio, fim, label };
}

async function buscarDados(factoryId: string, clienteId: string, competencia: string) {
  const periodo = periodoMensal(competencia);
  const [clientesResult, itensResult] = await Promise.all([
    supabase.from("clientes").select("id,nome,telefone").eq("factory_id", factoryId).eq("status", "ativo").order("nome"),
    clienteId
      ? (supabase as any).from("venda_itens")
        .select("id,venda_id,quantidade,preco_unitario,subtotal,sabores(nome),vendas!inner(id,numero_pedido,created_at,status,cliente_id)")
        .eq("factory_id", factoryId).eq("vendas.cliente_id", clienteId).neq("vendas.status", "cancelada")
        .gte("vendas.created_at", periodo.inicio).lt("vendas.created_at", periodo.fim).limit(10000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientesResult.error) throw clientesResult.error;
  if (itensResult.error) throw itensResult.error;
  return { clientes: (clientesResult.data ?? []) as ClienteMensal[], itens: (itensResult.data ?? []) as ItemMensalRaw[], periodo };
}

export default function RelatorioMensalCliente() {
  const { factoryId, factoryName, branding } = useAuth();
  const [clienteId, setClienteId] = useState("");
  const [competencia, setCompetencia] = useState(mesAtual);
  const { data, isLoading, error } = useQuery({
    queryKey: ["relatorio-mensal-cliente", factoryId, clienteId, competencia],
    queryFn: () => buscarDados(String(factoryId), clienteId, competencia),
    enabled: Boolean(factoryId), staleTime: 5 * 60 * 1000,
  });
  const resumo = useMemo(() => analisarComprasMensais(data?.itens ?? []), [data?.itens]);
  const cliente = data?.clientes.find((item) => item.id === clienteId);
  const periodoLabel = data?.periodo.label ?? periodoMensal(competencia).label;

  const gerarPdf = async (salvar: boolean) => {
    if (!cliente || resumo.itens.length === 0) return null;
    return exportToPDF(
      `Relatório Mensal de Compras - ${cliente.nome}`,
      ["#", "Sabor", "Unidades", "Participação", "Preço médio", "Economia"],
      resumo.ranking.map((sabor, index) => [index + 1, sabor.nome, sabor.quantidade, `${sabor.participacao.toFixed(1)}%`, brl(sabor.precoMedio), brl(sabor.economia)]),
      `compras_${cliente.nome.replace(/[^a-z0-9]+/gi, "_")}_${competencia}`,
      [
        { label: "Período", value: periodoLabel }, { label: "Pedidos", value: String(resumo.totalPedidos) },
        { label: "Gelos", value: String(resumo.totalUnidades) }, { label: "Economia", value: brl(resumo.totalEconomia) },
      ],
      "relatorio-mensal-cliente-graficos",
      { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl },
      [{ label: "Preço de referência", value: brl(PRECO_REFERENCIA_GELO) }, { label: "Valor pago", value: brl(resumo.totalPago) }, { label: "Economia no mês", value: brl(resumo.totalEconomia) }],
      {
        save: salvar,
        extraTables: [{
          title: "Detalhamento das compras",
          headers: ["Data", "Comanda", "Sabor", "Quantidade", "Preço unit.", "Valor pago", "Economia"],
          rows: resumo.itens.map((item) => [new Date(item.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), item.numeroPedido ? `#${item.numeroPedido}` : "—", item.sabor, item.quantidade, item.brinde ? "Brinde" : brl(item.precoUnitario), brl(item.valorPago), brl(item.economia)]),
        }],
      },
    );
  };

  const compartilhar = async () => {
    if (!cliente) return;
    const doc = await gerarPdf(false);
    if (!doc) return;
    const nomeArquivo = `compras_${cliente.nome.replace(/[^a-z0-9]+/gi, "_")}_${competencia}.pdf`;
    const file = new File([doc.output("blob")], nomeArquivo, { type: "application/pdf" });
    const mensagem = `Olá, ${cliente.nome}! Segue seu relatório de ${periodoLabel}: ${resumo.totalUnidades} gelos saborizados em ${resumo.totalPedidos} pedido(s). Você economizou ${brl(resumo.totalEconomia)} em relação ao valor padrão de ${brl(PRECO_REFERENCIA_GELO)} por unidade.`;
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ text: mensagem, files: [file] }); return; } catch { /* compartilhamento cancelado */ }
    }
    doc.save(nomeArquivo);
    const telefone = (cliente.telefone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${telefone ? `55${telefone}` : ""}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
    toast.info("O PDF foi baixado para você anexar no WhatsApp.");
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_220px_auto] md:items-end">
        <div><Label className="mb-1 block text-xs">Cliente</Label><Select value={clienteId} onValueChange={setClienteId}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent className="max-h-80">{data?.clientes.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="competencia-cliente" className="mb-1 block text-xs">Mês do relatório</Label><Input id="competencia-cliente" type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)} /></div>
        <div className="flex gap-2"><Button variant="outline" disabled={!cliente || resumo.itens.length === 0} onClick={() => void gerarPdf(true)}><FileText /> PDF</Button><Button disabled={!cliente || resumo.itens.length === 0} onClick={() => void compartilhar()}><Share2 /> Compartilhar PDF</Button></div>
      </CardContent></Card>

      {isLoading ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-72" /></div>
        : error ? <Card><CardContent className="py-12 text-center text-destructive">Não foi possível carregar o relatório mensal.</CardContent></Card>
        : !cliente ? <Card><CardContent className="py-14 text-center"><Medal className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">Selecione um cliente e um mês</p><p className="text-sm text-muted-foreground">O ranking, os gráficos e a economia aparecerão aqui.</p></CardContent></Card>
        : resumo.itens.length === 0 ? <Card><CardContent className="py-14 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">Nenhum gelo saborizado comprado em {periodoLabel}</p></CardContent></Card>
        : <>
          <div><h2 className="text-lg font-semibold">{cliente.nome}</h2><p className="text-sm capitalize text-muted-foreground">Resumo de {periodoLabel} · Referência: {brl(PRECO_REFERENCIA_GELO)} por unidade</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard title="Gelos Comprados" value={String(resumo.totalUnidades)} icon={Package} subtitle={`${resumo.totalBrindes} brinde(s)`} /><KpiCard title="Pedidos no Mês" value={String(resumo.totalPedidos)} icon={ShoppingBag} /><KpiCard title="Valor Pago" value={brl(resumo.totalPago)} icon={Wallet} subtitle={`Média: ${brl(resumo.precoMedio)}/un`} /><KpiCard title="Economia" value={brl(resumo.totalEconomia)} icon={Gift} subtitle={`Comparado a ${brl(PRECO_REFERENCIA_GELO)}/un`} /></div>
          <RelatorioMensalClienteCharts ranking={resumo.ranking} />
          <Card><CardHeader><CardTitle className="text-base">Ranking mensal por sabores</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Sabor</TableHead><TableHead className="text-right">Unidades</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Economia</TableHead></TableRow></TableHeader><TableBody>{resumo.ranking.map((sabor, index) => <TableRow key={sabor.nome}><TableCell className="font-semibold">{index + 1}</TableCell><TableCell>{sabor.nome}</TableCell><TableCell className="text-right">{sabor.quantidade}</TableCell><TableCell className="text-right">{sabor.participacao.toFixed(1)}%</TableCell><TableCell className="text-right">{brl(sabor.precoMedio)}</TableCell><TableCell className="text-right font-medium text-primary">{brl(sabor.economia)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Compras do mês</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Comanda</TableHead><TableHead>Sabor</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Preço unit.</TableHead><TableHead className="text-right">Economia</TableHead></TableRow></TableHeader><TableBody>{resumo.itens.map((item) => <TableRow key={item.id}><TableCell>{new Date(item.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell><TableCell>{item.numeroPedido ? `#${item.numeroPedido}` : "—"}</TableCell><TableCell>{item.sabor}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right">{item.brinde ? "Brinde" : brl(item.precoUnitario)}</TableCell><TableCell className="text-right">{brl(item.economia)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </>}
    </div>
  );
}