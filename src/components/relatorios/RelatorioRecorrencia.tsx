import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, FileSpreadsheet, FileText, Package, Search, ShoppingCart, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import DateRangeFilter from "./DateRangeFilter";
import KpiCard from "./KpiCard";
import RecorrenciaClienteDialog from "./RecorrenciaClienteDialog";
import RecorrenciaLista from "./RecorrenciaLista";
import { analisarRecorrencia, VendaRecorrenciaRaw } from "./recorrencia-analysis";
import { ClienteRecorrencia, formatarData, formatarQuantidade, RecorrenciaStatus, statusLabels } from "./recorrencia-types";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface ClienteRaw {
  id: string;
  nome: string;
}

interface RecorrenciaData {
  clientes: ClienteRaw[];
  vendas: VendaRecorrenciaRaw[];
}

type StatusFiltro = "todos" | RecorrenciaStatus;

async function buscarRecorrencia(factoryId: string, inicio?: Date, fim?: Date): Promise<RecorrenciaData> {
  const clientesRequest = supabase
    .from("clientes")
    .select("id, nome")
    .eq("factory_id", factoryId)
    .eq("status", "ativo")
    .order("nome");

  const vendas: VendaRecorrenciaRaw[] = [];
  let pagina = 0;
  const tamanhoPagina = 1000;

  while (true) {
    let request = supabase
      .from("vendas")
      .select("id, cliente_id, created_at, numero_pedido, total, venda_itens(quantidade, sabores(nome)), venda_bebida_itens(nome, quantidade, tipo_venda, bebidas(unidades_fardo)), venda_gelo_cubo_itens(quantidade, tamanho)")
      .eq("factory_id", factoryId)
      .neq("status", "cancelada")
      .order("created_at", { ascending: true })
      .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);
    if (inicio) request = request.gte("created_at", inicio.toISOString());
    if (fim) {
      const fimInclusivo = new Date(fim);
      fimInclusivo.setHours(23, 59, 59, 999);
      request = request.lte("created_at", fimInclusivo.toISOString());
    }

    const { data, error } = await request;
    if (error) throw error;
    const lote = (data ?? []) as unknown as VendaRecorrenciaRaw[];
    vendas.push(...lote);
    if (lote.length < tamanhoPagina) break;
    pagina += 1;
  }

  const { data: clientes, error: clientesError } = await clientesRequest;
  if (clientesError) throw clientesError;
  return { clientes: (clientes ?? []) as ClienteRaw[], vendas };
}

export default function RelatorioRecorrencia() {
  const { factoryId, factoryName } = useAuth();
  const [inicio, setInicio] = useState<Date>();
  const [fim, setFim] = useState<Date>();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("todos");
  const [selecionado, setSelecionado] = useState<ClienteRecorrencia | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["relatorio-recorrencia-detalhado", factoryId, inicio?.toISOString(), fim?.toISOString()],
    queryFn: () => buscarRecorrencia(String(factoryId), inicio, fim),
    enabled: Boolean(factoryId),
    staleTime: 5 * 60 * 1000,
  });

  const analise = useMemo(
    () => analisarRecorrencia(data?.clientes ?? [], data?.vendas ?? []),
    [data],
  );
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return analise.filter((cliente) =>
      (status === "todos" || cliente.status === status)
      && (!termo || cliente.nome.toLocaleLowerCase("pt-BR").includes(termo)),
    );
  }, [analise, busca, status]);

  const regulares = analise.filter((cliente) => cliente.status === "regular" || cliente.status === "em_breve").length;
  const atrasados = analise.filter((cliente) => cliente.status === "atrasado").length;
  const totalUnidades = analise.reduce((total, cliente) => total + cliente.totalUnidades, 0);
  const frequencias = analise.filter((cliente) => cliente.frequenciaMedia > 0).map((cliente) => cliente.frequenciaMedia);
  const frequenciaGeral = frequencias.length > 0 ? Math.round(frequencias.reduce((total, dias) => total + dias, 0) / frequencias.length) : 0;

  const linhasExportacao = filtrados.map((cliente) => [
    cliente.nome,
    cliente.totalCompras,
    formatarQuantidade(cliente.totalUnidades),
    formatarQuantidade(cliente.mediaUnidades),
    cliente.frequenciaMedia || "-",
    formatarData(cliente.ultimaCompra),
    cliente.proximaCompra ? formatarData(cliente.proximaCompra) : "-",
    cliente.diasAtraso,
    statusLabels[cliente.status],
    cliente.produtosFavoritos[0]?.nome ?? "-",
  ]);
  const cabecalhos = ["Cliente", "Compras", "Unidades", "Média/pedido", "Frequência (dias)", "Última compra", "Próxima prevista", "Dias atraso", "Situação", "Produto favorito"];

  const exportarPDF = () => exportToPDF(
    `Recorrência de Clientes - ${factoryName}`,
    cabecalhos,
    linhasExportacao,
    "recorrencia-clientes",
    [
      { label: "Clientes analisados", value: String(analise.length) },
      { label: "Clientes atrasados", value: String(atrasados) },
      { label: "Unidades vendidas", value: formatarQuantidade(totalUnidades) },
      { label: "Intervalo médio", value: frequenciaGeral ? `${frequenciaGeral} dias` : "-" },
    ],
    undefined,
    { factoryName },
  );

  const exportarExcel = () => exportToExcel(cabecalhos, linhasExportacao, "Recorrência", "recorrencia-clientes");

  return (
    <div className="space-y-4">
      <DateRangeFilter startDate={inicio} endDate={fim} onStartChange={setInicio} onEndChange={setFim}>
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="busca-recorrencia" className="mb-1 block text-xs">Buscar cliente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input id="busca-recorrencia" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome do cliente" className="pl-9" />
          </div>
        </div>
        <div className="min-w-[170px]">
          <Label className="mb-1 block text-xs">Situação</Label>
          <Select value={status} onValueChange={(value: StatusFiltro) => setStatus(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="em_breve">Comprar em breve</SelectItem>
              <SelectItem value="regular">Regulares</SelectItem>
              <SelectItem value="novo">Novos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DateRangeFilter>

      {isLoading ? (
        <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><Skeleton className="h-72" /></div>
      ) : error ? (
        <Card><CardContent className="py-10 text-center"><p className="font-medium text-destructive">Não foi possível carregar a recorrência.</p><p className="mt-1 text-sm text-muted-foreground">Tente novamente em instantes.</p></CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard title="Clientes Analisados" value={String(analise.length)} icon={Users} />
            <KpiCard title="Regulares / Em Breve" value={String(regulares)} icon={ShoppingCart} />
            <KpiCard title="Atrasados" value={String(atrasados)} icon={CalendarClock} />
            <KpiCard title="Unidades Vendidas" value={formatarQuantidade(totalUnidades)} icon={Package} />
            <div className="col-span-2 lg:col-span-1"><KpiCard title="Intervalo Médio Geral" value={frequenciaGeral ? `${frequenciaGeral} dias` : "—"} icon={CalendarClock} /></div>
          </div>

          <Card>
            <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="text-base">Ciclo de compra por cliente</CardTitle><p className="mt-1 text-xs text-muted-foreground">Clique em um cliente para ver cada compra, intervalo e produto.</p></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportarPDF} disabled={filtrados.length === 0}><FileText /> PDF</Button>
                <Button size="sm" variant="outline" onClick={exportarExcel} disabled={filtrados.length === 0}><FileSpreadsheet /> Excel</Button>
              </div>
            </CardHeader>
            <CardContent>
              {filtrados.length > 0 ? <RecorrenciaLista clientes={filtrados} onSelect={setSelecionado} /> : <div className="py-12 text-center"><Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="font-medium">Nenhum cliente encontrado</p><p className="text-sm text-muted-foreground">Ajuste o período, a situação ou a busca.</p></div>}
            </CardContent>
          </Card>
        </>
      )}

      <RecorrenciaClienteDialog cliente={selecionado} open={Boolean(selecionado)} onOpenChange={(open) => { if (!open) setSelecionado(null); }} />
    </div>
  );
}