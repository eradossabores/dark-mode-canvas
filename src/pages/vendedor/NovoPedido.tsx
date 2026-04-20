import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { realizarVenda } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, ShoppingCart, CalendarIcon } from "lucide-react";
import ReciboVenda from "@/components/vendas/ReciboVenda";

const FORMAS_PAGAMENTO = [
  { value: "amostra", label: "Amostra (Grátis)" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "parcelado", label: "Parcelado" },
  { value: "fiado", label: "A Prazo" },
];

const TOP_SABORES = ["melancia", "morango", "maca verde", "maracuja", "agua de coco"];

function normalizeStr(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[çÇ]/g, "c");
}

export default function NovoPedido() {
  const { user, factoryId } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state (igual ao de Vendas)
  const [clienteId, setClienteId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [numeroNf, setNumeroNf] = useState("");
  const [itens, setItens] = useState<{ sabor_id: string; quantidade: number; preco_unitario: string; preco_auto: boolean }[]>([]);
  const [dataVenda, setDataVenda] = useState<Date>(new Date());
  const [valorTotal, setValorTotal] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [valorRestante, setValorRestante] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(undefined);
  const [calendarVencOpen, setCalendarVencOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [ignorarEstoque, setIgnorarEstoque] = useState(false);
  const [statusVenda, setStatusVenda] = useState("pendente");
  const [detalhePgto, setDetalhePgto] = useState<"pix" | "especie" | "misto">("especie");
  const [detalhePix, setDetalhePix] = useState("");
  const [detalheEspecie, setDetalheEspecie] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [fretePagoPor, setFretePagoPor] = useState<"empresa" | "cliente" | "ambos">("cliente");
  const [brindes, setBrindes] = useState<{ sabor_id: string; quantidade: string }[]>([]);

  // Gelo Cubo
  const [factoryVendeGeloCubo, setFactoryVendeGeloCubo] = useState(false);
  const [geloCuboPrecos, setGeloCuboPrecos] = useState<Record<string, number>>({});
  const [geloCuboItens, setGeloCuboItens] = useState<{ tamanho: string; quantidade: number }[]>([]);

  // Sacos
  const [factoryUsaSacos, setFactoryUsaSacos] = useState(false);
  const [factoryUnidadesPorSaco, setFactoryUnidadesPorSaco] = useState(50);
  const [vendaPorPacote, setVendaPorPacote] = useState(false);

  // Recibo
  const [reciboOpen, setReciboOpen] = useState(false);
  const [reciboData, setReciboData] = useState<any>(null);

  useEffect(() => { load(); }, [factoryId]);

  async function load() {
    if (!factoryId) return;
    // Factory config
    const { data: fConfig } = await (supabase as any)
      .from("factories").select("usa_sacos, unidades_por_saco, vende_gelo_cubo").eq("id", factoryId).single();
    if (fConfig) {
      setFactoryUsaSacos(fConfig.usa_sacos || false);
      setFactoryUnidadesPorSaco(fConfig.unidades_por_saco || 50);
      setFactoryVendeGeloCubo(fConfig.vende_gelo_cubo || false);
      if (fConfig.vende_gelo_cubo) {
        const { data: cuboPrecos } = await (supabase as any)
          .from("gelo_cubo_precos").select("tamanho, preco").eq("factory_id", factoryId);
        if (cuboPrecos) {
          const map: Record<string, number> = {};
          cuboPrecos.forEach((p: any) => { map[p.tamanho] = Number(p.preco); });
          setGeloCuboPrecos(map);
        }
      }
    }
    // Clientes (filtrados por RLS, vendedor só vê os seus) e sabores
    const [{ data: cli }, { data: sab }] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome").eq("status", "ativo").eq("factory_id", factoryId).order("nome"),
      (supabase as any).from("sabores").select("*").eq("ativo", true).eq("factory_id", factoryId).order("nome"),
    ]);
    setClientes(cli || []);
    setSabores(sab || []);

    // Pré-seleciona top sabores
    const preSelected = TOP_SABORES
      .map((name) => (sab || []).find((s: any) => normalizeStr(s.nome) === name || normalizeStr(s.nome).includes(name)))
      .filter(Boolean)
      .map((s: any) => ({ sabor_id: s.id, quantidade: 0, preco_unitario: "", preco_auto: false }));
    if (preSelected.length > 0 && itens.length === 0) setItens(preSelected);
  }

  function parseDecimal(v: string): number { return Number(String(v).replace(",", ".")) || 0; }
  function formatDecimalInput(v: string): string { return v.replace(/[^0-9.,]/g, ""); }
  function addItem() { setItens([...itens, { sabor_id: "", quantidade: 1, preco_unitario: "", preco_auto: false }]); }
  function removeItem(i: number) { setItens(itens.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, val: any) {
    const list = [...itens];
    if (field === "quantidade") (list[i] as any)[field] = Number(val);
    else if (field === "preco_unitario") { list[i].preco_unitario = val; list[i].preco_auto = false; }
    else (list[i] as any)[field] = val;
    setItens(list);
    if ((field === "sabor_id" || field === "quantidade") && clienteId) {
      recalcPrecosTotalComanda(list, clienteId);
    }
  }

  async function fetchPreco(cId: string, sId: string, qtd: number): Promise<number | null> {
    try {
      const { data, error } = await supabase.rpc("calcular_preco" as any, { p_cliente_id: cId, p_sabor_id: sId, p_quantidade: qtd });
      if (error) return null;
      return data as number;
    } catch { return null; }
  }

  async function recalcPrecosTotalComanda(currentItens: typeof itens, cId: string) {
    const totalQtd = currentItens.reduce((s, it) => {
      const qty = vendaPorPacote ? (it.quantidade || 0) * factoryUnidadesPorSaco : (it.quantidade || 0);
      return s + qty;
    }, 0);
    const updated = [...currentItens];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].sabor_id && updated[i].quantidade > 0) {
        const preco = await fetchPreco(cId, updated[i].sabor_id, totalQtd);
        if (preco !== null) { updated[i].preco_unitario = preco.toFixed(2); updated[i].preco_auto = true; }
      }
    }
    setItens(updated);
  }

  async function recalcPrecos(cId: string) {
    recalcPrecosTotalComanda(itens, cId);
    if (factoryVendeGeloCubo && cId) {
      try {
        const { data: clienteCuboPrecos } = await (supabase as any)
          .from("cliente_gelo_cubo_preco").select("tamanho, preco").eq("cliente_id", cId);
        if (clienteCuboPrecos && clienteCuboPrecos.length > 0) {
          const map: Record<string, number> = { ...geloCuboPrecos };
          clienteCuboPrecos.forEach((p: any) => { map[p.tamanho] = Number(p.preco); });
          setGeloCuboPrecos(map);
        } else {
          const { data: factoryPrecos } = await (supabase as any)
            .from("gelo_cubo_precos").select("tamanho, preco").eq("factory_id", factoryId);
          if (factoryPrecos) {
            const map: Record<string, number> = {};
            factoryPrecos.forEach((p: any) => { map[p.tamanho] = Number(p.preco); });
            setGeloCuboPrecos(map);
          }
        }
      } catch { /* ignore */ }
    }
  }

  function resetForm() {
    setItens([]); setClienteId(""); setFormaPagamento("dinheiro"); setObservacoes(""); setNumeroNf("");
    setDataVenda(new Date()); setValorTotal(""); setValorEntrada(""); setValorRestante("");
    setDataVencimento(undefined); setIgnorarEstoque(false); setStatusVenda("pendente");
    setDetalhePgto("especie"); setDetalhePix(""); setDetalheEspecie(""); setValorFrete("");
    setFretePagoPor("cliente"); setBrindes([]); setVendaPorPacote(false); setGeloCuboItens([]);
  }

  async function handleSubmit() {
    let itensValidos = itens.filter((i) => i.sabor_id && i.quantidade > 0).map((i) => ({
      ...i,
      quantidade: vendaPorPacote ? i.quantidade * factoryUnidadesPorSaco : i.quantidade,
    }));
    brindes.forEach((b) => {
      if (Number(b.quantidade) > 0 && b.sabor_id) {
        itensValidos.push({ sabor_id: b.sabor_id, quantidade: Number(b.quantidade), preco_unitario: "0", preco_auto: false });
      }
    });
    if (itensValidos.length === 0) return toast({ title: "Adicione ao menos um gelo com quantidade", variant: "destructive" });
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });

    setLoading(true);
    const totalQtdFinal = itensValidos.reduce((s, it) => s + (it.quantidade || 0), 0);
    for (let i = 0; i < itensValidos.length; i++) {
      if (itensValidos[i].preco_auto === false) continue;
      if (!itensValidos[i].preco_unitario) {
        const preco = await fetchPreco(clienteId, itensValidos[i].sabor_id, totalQtdFinal);
        if (preco !== null) {
          itensValidos[i].preco_unitario = preco.toFixed(2);
          itensValidos[i].preco_auto = true;
        }
      }
    }

    try {
      const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vencimentoStr = dataVencimento
        ? toLocalDateStr(dataVencimento)
        : toLocalDateStr(new Date(dataVenda.getTime() + 30 * 86400000));
      const parcelasData = formaPagamento === "parcelado" && valorEntrada
        ? [
            { valor: parseDecimal(valorEntrada), vencimento: toLocalDateStr(dataVenda) },
            ...(parseDecimal(valorRestante) > 0 ? [{ valor: parseDecimal(valorRestante), vencimento: vencimentoStr }] : []),
          ]
        : formaPagamento === "boleto"
        ? [{ valor: itensValidos.reduce((s, i) => s + (Number(i.preco_unitario) || 0) * i.quantidade, 0), vencimento: vencimentoStr }]
        : undefined;

      const vencInfo = (formaPagamento === "boleto" || formaPagamento === "parcelado") && dataVencimento
        ? ` | Vencimento: ${format(dataVencimento, "dd/MM/yyyy")}` : "";
      const freteInfo = parseDecimal(valorFrete) > 0
        ? ` | Frete: R$${parseDecimal(valorFrete).toFixed(2)} (${fretePagoPor === "empresa" ? "empresa" : "cliente"})` : "";
      const brindeInfo = brindes.filter((b) => Number(b.quantidade) > 0 && b.sabor_id).length > 0
        ? ` | Brindes: ${brindes.filter((b) => Number(b.quantidade) > 0 && b.sabor_id).map((b) => `${b.quantidade}un`).join(", ")}` : "";

      await realizarVenda({
        p_cliente_id: clienteId,
        p_operador: user?.email || "vendedor",
        p_observacoes: observacoes
          ? `[${formaPagamento}]${formaPagamento === "parcelado" && valorTotal ? ` Valor: R$${valorTotal} | Entrada: R$${valorEntrada} | Restante: R$${valorRestante}` : ""}${vencInfo}${freteInfo}${brindeInfo} ${observacoes}`
          : `[${formaPagamento}]${formaPagamento === "parcelado" && valorTotal ? ` Valor: R$${valorTotal} | Entrada: R$${valorEntrada} | Restante: R$${valorRestante}` : ""}${vencInfo}${freteInfo}${brindeInfo}`,
        p_itens: itensValidos,
        ...(parcelasData ? { p_parcelas: parcelasData } : {}),
        p_ignorar_estoque: ignorarEstoque,
      });

      const { data: latestVenda } = await (supabase as any)
        .from("vendas").select("id").eq("cliente_id", clienteId)
        .eq("factory_id", factoryId)
        .order("created_at", { ascending: false }).limit(1);

      let vendaId: string | null = latestVenda?.[0]?.id || null;
      if (vendaId) {
        const brindeSaborIds = brindes.filter((b) => Number(b.quantidade) > 0 && b.sabor_id).map((b) => b.sabor_id);
        if (brindeSaborIds.length > 0) {
          await (supabase as any).from("venda_itens")
            .update({ preco_unitario: 0, subtotal: 0 })
            .eq("venda_id", vendaId).in("sabor_id", brindeSaborIds);
        }
        const totalProdutos = itensValidos
          .filter((i) => !brindeSaborIds.includes(i.sabor_id))
          .reduce((s, i) => s + (Number(i.preco_unitario) || 0) * i.quantidade, 0);
        const freteTotal = parseDecimal(valorFrete) || 0;
        const freteCliente = fretePagoPor === "cliente" ? freteTotal : fretePagoPor === "ambos" ? Math.round(freteTotal / 2 * 100) / 100 : 0;
        const freteEmpresa = fretePagoPor === "empresa" ? freteTotal : fretePagoPor === "ambos" ? Math.round(freteTotal / 2 * 100) / 100 : 0;
        const geloCuboSubtotal = geloCuboItens.reduce((s, it) => s + (geloCuboPrecos[it.tamanho] || 0) * it.quantidade, 0);
        const totalVendaCalc = totalProdutos + freteCliente + geloCuboSubtotal;
        const vPix = detalhePgto === "pix" ? totalVendaCalc : detalhePgto === "misto" ? (parseFloat(detalhePix.replace(",", ".")) || 0) : 0;
        const vEsp = detalhePgto === "especie" ? totalVendaCalc : detalhePgto === "misto" ? (parseFloat(detalheEspecie.replace(",", ".")) || 0) : 0;
        const updateData: any = {
          forma_pagamento: formaPagamento, status: statusVenda,
          valor_pix: vPix, valor_especie: vEsp, total: totalVendaCalc,
          valor_frete: freteTotal, frete_pago_por: fretePagoPor,
        };
        if (numeroNf.trim()) updateData.numero_nf = numeroNf.trim();
        await (supabase as any).from("vendas").update(updateData).eq("id", vendaId);

        if (geloCuboItens.length > 0) {
          const cuboInserts = geloCuboItens.filter((it) => it.quantidade > 0).map((it) => ({
            venda_id: vendaId, factory_id: factoryId, tamanho: it.tamanho,
            quantidade: it.quantidade, preco_unitario: geloCuboPrecos[it.tamanho] || 0,
            subtotal: (geloCuboPrecos[it.tamanho] || 0) * it.quantidade,
          }));
          if (cuboInserts.length > 0) {
            await (supabase as any).from("venda_gelo_cubo_itens").insert(cuboInserts);
            for (const ci of cuboInserts) {
              const { data: estCubo } = await (supabase as any)
                .from("estoque_gelo_cubo").select("id, quantidade")
                .eq("factory_id", factoryId).eq("tamanho", ci.tamanho).single();
              if (estCubo) {
                await (supabase as any).from("estoque_gelo_cubo")
                  .update({ quantidade: estCubo.quantidade - ci.quantidade, updated_at: new Date().toISOString() })
                  .eq("id", estCubo.id);
              }
            }
          }
        }

        if (freteEmpresa > 0) {
          const clienteNomeFrete = clientes.find((c) => c.id === clienteId)?.nome || "?";
          await (supabase as any).from("contas_a_pagar").insert({
            descricao: `Frete - Venda para ${clienteNomeFrete}`,
            tipo: "avulso", valor_parcela: freteEmpresa, valor_total: freteEmpresa,
            total_parcelas: 1, parcela_atual: 1, pago_mes: true, ativa: false,
            responsavel: "Frete", factory_id: factoryId,
          });
        }

        // Ajustar data se diferente de hoje
        const hoje = new Date();
        if (dataVenda.toDateString() !== hoje.toDateString()) {
          const localStr = `${dataVenda.getFullYear()}-${String(dataVenda.getMonth() + 1).padStart(2, "0")}-${String(dataVenda.getDate()).padStart(2, "0")}T12:00:00`;
          await (supabase as any).from("vendas").update({ created_at: localStr }).eq("id", vendaId);
        }

        // Sacos
        if (factoryUsaSacos && vendaPorPacote && factoryId) {
          const totalUnidadesVendidas = itensValidos.reduce((s, i) => s + i.quantidade, 0);
          const sacosConsumidos = Math.ceil(totalUnidadesVendidas / factoryUnidadesPorSaco);
          const { data: estoqueAtual } = await (supabase as any)
            .from("estoque_sacos").select("quantidade").eq("factory_id", factoryId).single();
          if (estoqueAtual) {
            await (supabase as any).from("estoque_sacos").update({
              quantidade: Math.max(0, estoqueAtual.quantidade - sacosConsumidos),
            }).eq("factory_id", factoryId);
          }
        }
      }

      toast({ title: "Pedido registrado com sucesso!" });

      // Recibo
      const clienteObj = clientes.find((c) => c.id === clienteId);
      if (vendaId) {
        const { data: clienteFull } = await (supabase as any)
          .from("clientes").select("telefone").eq("id", clienteId).single();
        const { data: itensData } = await (supabase as any)
          .from("venda_itens").select("*, sabores(nome)").eq("venda_id", vendaId);
        const brindeSaborIdsAudit = brindes.filter((b) => Number(b.quantidade) > 0 && b.sabor_id).map((b) => b.sabor_id);
        const totalVenda = itensValidos.filter((i) => !brindeSaborIdsAudit.includes(i.sabor_id))
          .reduce((s, i) => s + (Number(i.preco_unitario) || 0) * i.quantidade, 0);
        setReciboData({
          cliente_nome: clienteObj?.nome || "?",
          data: dataVenda.toLocaleDateString("pt-BR"),
          forma_pagamento: FORMAS_PAGAMENTO.find((f) => f.value === formaPagamento)?.label || formaPagamento,
          numero_nf: numeroNf.trim() || undefined,
          total: totalVenda + (parseDecimal(valorFrete) > 0 && fretePagoPor !== "empresa"
            ? (fretePagoPor === "ambos" ? parseDecimal(valorFrete) / 2 : parseDecimal(valorFrete)) : 0),
          observacoes: observacoes || undefined,
          telefone: clienteFull?.telefone || undefined,
          status: statusVenda as "pendente" | "paga" | "cancelada",
          valor_pago: statusVenda === "paga" ? totalVenda : 0,
          valor_frete: parseDecimal(valorFrete) || 0,
          frete_pago_por: fretePagoPor,
          itens: (itensData || []).map((it: any) => ({
            sabor_nome: it.sabores?.nome || "?",
            quantidade: it.quantidade,
            preco_unitario: Number(it.preco_unitario),
            subtotal: Number(it.subtotal),
          })),
        });
        setReciboOpen(true);
      }

      resetForm();
      load();
    } catch (e: any) {
      toast({ title: "Erro ao registrar pedido", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> Novo Pedido</h1>
        <p className="text-sm text-muted-foreground">Lance um pedido para um dos seus clientes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Nova Venda</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Data da Venda</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataVenda && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataVenda ? format(dataVenda, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataVenda} onSelect={(d) => { if (d) setDataVenda(d); setCalendarOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={(v) => { setClienteId(v); recalcPrecos(v); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Venda por Pacote */}
          <div className="space-y-2 p-3 border-2 rounded-lg bg-muted/30 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold">📦 Venda por Pacote</Label>
                <p className="text-[10px] text-muted-foreground">
                  {factoryUsaSacos ? `1 pacote = ${factoryUnidadesPorSaco} unidades. Quantidades em pacotes.` : "Ative 'Usa Sacos' nas configurações da fábrica para usar pacotes."}
                </p>
              </div>
              <Switch checked={vendaPorPacote} onCheckedChange={(v) => { setVendaPorPacote(v); if (clienteId && itens.length > 0) setTimeout(() => recalcPrecosTotalComanda(itens, clienteId), 50); }} disabled={!factoryUsaSacos} />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Gelos
                {vendaPorPacote && <Badge variant="secondary" className="text-[10px] ml-1">Modo Pacote</Badge>}
              </Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
            </div>
            {itens.length === 0 && <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">Clique em "Add"</p>}
            {itens.map((item, i) => (
              <div key={i} className={cn("flex gap-2 mb-2 items-center rounded-lg px-2 py-1.5 transition-colors", item.quantidade > 0 && "bg-secondary/60 ring-1 ring-secondary")}>
                <Select value={item.sabor_id} onValueChange={(v) => updateItem(i, "sabor_id", v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor" /></SelectTrigger>
                  <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
                <div className="relative">
                  <Input type="number" className="w-20" min={1} value={item.quantidade || ""} onChange={(e) => updateItem(i, "quantidade", e.target.value)} placeholder={vendaPorPacote ? "Pct" : "Qtd"} />
                  {vendaPorPacote && item.quantidade > 0 && (
                    <span className="absolute -bottom-4 left-0 text-[9px] text-muted-foreground whitespace-nowrap">= {item.quantidade * factoryUnidadesPorSaco} un</span>
                  )}
                </div>
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input type="text" inputMode="decimal" className={cn("pl-7 text-xs", item.preco_auto && "bg-muted/50")} value={item.preco_unitario} onChange={(e) => updateItem(i, "preco_unitario", formatDecimalInput(e.target.value))} placeholder="0,00" />
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            {itens.length > 0 && (
              <div className="mt-3 pt-3 border-t font-semibold space-y-1">
                <div className="flex justify-between items-center">
                  <span>Total de Gelos:</span>
                  <span className="text-lg">
                    {vendaPorPacote
                      ? <>{itens.reduce((sum, item) => sum + (item.quantidade || 0), 0)} pacote(s) <span className="text-xs font-normal text-muted-foreground">({itens.reduce((sum, item) => sum + (item.quantidade || 0), 0) * factoryUnidadesPorSaco} un.)</span></>
                      : <>{itens.reduce((sum, item) => sum + (item.quantidade || 0), 0)} un.</>
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Subtotal Produtos:</span>
                  <span>R$ {itens.reduce((sum, item) => {
                    const qty = vendaPorPacote ? (item.quantidade || 0) * factoryUnidadesPorSaco : (item.quantidade || 0);
                    return sum + (parseDecimal(String(item.preco_unitario)) || 0) * qty;
                  }, 0).toFixed(2)}</span>
                </div>
                {parseDecimal(valorFrete) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span>Frete ({fretePagoPor === "empresa" ? "🏭 empresa" : fretePagoPor === "ambos" ? "🤝 50/50" : "👤 cliente"}):</span>
                    <span>R$ {parseDecimal(valorFrete).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>Total da Venda:</span>
                  <span className="text-lg">R$ {(() => {
                    const subtotalProd = itens.reduce((sum, item) => {
                      const qty = vendaPorPacote ? (item.quantidade || 0) * factoryUnidadesPorSaco : (item.quantidade || 0);
                      return sum + (parseDecimal(String(item.preco_unitario)) || 0) * qty;
                    }, 0);
                    const frete = parseDecimal(valorFrete) || 0;
                    const freteNaComanda = fretePagoPor === "cliente" ? frete : fretePagoPor === "ambos" ? Math.round(frete / 2 * 100) / 100 : 0;
                    const geloCuboTotal = geloCuboItens.reduce((s, it) => s + (geloCuboPrecos[it.tamanho] || 0) * it.quantidade, 0);
                    return (subtotalProd + freteNaComanda + geloCuboTotal).toFixed(2);
                  })()}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={(v) => { setFormaPagamento(v); if (v !== "parcelado") { setValorTotal(""); setValorEntrada(""); setValorRestante(""); } if (v !== "boleto" && v !== "parcelado") { setDataVencimento(undefined); } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={statusVenda} onValueChange={setStatusVenda}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formaPagamento === "dinheiro" || formaPagamento === "pix") && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label className="text-xs font-medium">Detalhe do pagamento</Label>
              <RadioGroup value={detalhePgto} onValueChange={(v: any) => setDetalhePgto(v)} className="flex gap-3">
                <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="np-pix" /><Label htmlFor="np-pix" className="text-xs cursor-pointer">PIX</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="especie" id="np-esp" /><Label htmlFor="np-esp" className="text-xs cursor-pointer">Espécie</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="misto" id="np-mix" /><Label htmlFor="np-mix" className="text-xs cursor-pointer">Misto</Label></div>
              </RadioGroup>
              {detalhePgto === "misto" && (
                <div className="flex gap-2">
                  <div className="flex-1"><Label className="text-xs">PIX (R$)</Label><Input type="text" inputMode="decimal" placeholder="0,00" value={detalhePix} onChange={(e) => setDetalhePix(e.target.value)} /></div>
                  <div className="flex-1"><Label className="text-xs">Espécie (R$)</Label><Input type="text" inputMode="decimal" placeholder="0,00" value={detalheEspecie} onChange={(e) => setDetalheEspecie(e.target.value)} /></div>
                </div>
              )}
            </div>
          )}

          {(formaPagamento === "boleto" || formaPagamento === "parcelado") && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label>Data de Vencimento / Pagamento Restante</Label>
                <Popover open={calendarVencOpen} onOpenChange={setCalendarVencOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataVencimento && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data de vencimento"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataVencimento} onSelect={(d) => { if (d) setDataVencimento(d); setCalendarVencOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              {formaPagamento === "parcelado" && (
                <>
                  <div><Label>Valor Total (R$)</Label><Input type="text" inputMode="decimal" value={valorTotal} onChange={(e) => { const v = formatDecimalInput(e.target.value); setValorTotal(v); const total = parseDecimal(v); const entrada = parseDecimal(valorEntrada); setValorRestante((total - entrada).toFixed(2)); }} placeholder="0,00" /></div>
                  <div><Label>Valor da Entrada (R$)</Label><Input type="text" inputMode="decimal" value={valorEntrada} onChange={(e) => { const v = formatDecimalInput(e.target.value); setValorEntrada(v); const total = parseDecimal(valorTotal); const entrada = parseDecimal(v); setValorRestante((total - entrada).toFixed(2)); }} placeholder="0,00" /></div>
                  <div><Label>Valor Restante (R$)</Label><Input type="text" inputMode="decimal" value={valorRestante} readOnly className="bg-muted" /></div>
                </>
              )}
            </div>
          )}

          <div><Label>Nº Nota Fiscal (NF)</Label><Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} placeholder="Ex: 001234" /></div>

          {/* Frete */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <Label className="text-xs font-medium">🚚 Frete (opcional)</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input type="text" inputMode="decimal" className="pl-7" value={valorFrete} onChange={(e) => setValorFrete(formatDecimalInput(e.target.value))} placeholder="0,00" />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 p-2 rounded-md bg-background border">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Frete pago por:</Label>
              <div className="flex items-center gap-2"><Checkbox id="np-frete-empresa" checked={fretePagoPor === "empresa"} onCheckedChange={() => setFretePagoPor("empresa")} /><Label htmlFor="np-frete-empresa" className="text-xs cursor-pointer font-medium">🏭 Empresa</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="np-frete-cliente" checked={fretePagoPor === "cliente"} onCheckedChange={() => setFretePagoPor("cliente")} /><Label htmlFor="np-frete-cliente" className="text-xs cursor-pointer font-medium">👤 Cliente</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="np-frete-ambos" checked={fretePagoPor === "ambos"} onCheckedChange={() => setFretePagoPor("ambos")} /><Label htmlFor="np-frete-ambos" className="text-xs cursor-pointer font-medium">🤝 Ambos (50/50)</Label></div>
            </div>
          </div>

          {/* Brindes */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">🎁 Brindes (opcional)</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setBrindes([...brindes, { sabor_id: "", quantidade: "" }])}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {brindes.map((b, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={b.sabor_id} onValueChange={(v) => { const u = [...brindes]; u[i].sabor_id = v; setBrindes(u); }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor" /></SelectTrigger>
                  <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min={0} className="w-20" value={b.quantidade} onChange={(e) => { const u = [...brindes]; u[i].quantidade = e.target.value; setBrindes(u); }} placeholder="Qtd" />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setBrindes(brindes.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>

          {/* Gelo Cubo */}
          {factoryVendeGeloCubo && Object.keys(geloCuboPrecos).length > 0 && (
            <div className="space-y-2 p-3 border-2 rounded-lg bg-muted/30 border-blue-500/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">🧊 Gelo em Cubos Filtrados</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setGeloCuboItens([...geloCuboItens, { tamanho: "2kg", quantidade: 1 }])}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {geloCuboItens.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={item.tamanho} onValueChange={(v) => { const u = [...geloCuboItens]; u[i].tamanho = v; setGeloCuboItens(u); }}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{["2kg", "4kg", "5kg"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={1} className="w-20" value={item.quantidade} onChange={(e) => { const u = [...geloCuboItens]; u[i].quantidade = Number(e.target.value); setGeloCuboItens(u); }} placeholder="Qtd" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">R$ {((geloCuboPrecos[item.tamanho] || 0) * item.quantidade).toFixed(2)}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setGeloCuboItens(geloCuboItens.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              {geloCuboItens.length > 0 && (
                <div className="text-xs font-medium text-right pt-1 border-t">
                  Subtotal Cubos: R$ {geloCuboItens.reduce((s, it) => s + (geloCuboPrecos[it.tamanho] || 0) * it.quantidade, 0).toFixed(2)}
                </div>
              )}
            </div>
          )}

          <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

          <div className="flex items-center space-x-2">
            <Checkbox id="np-ignorar-estoque" checked={ignorarEstoque} onCheckedChange={(v) => setIgnorarEstoque(!!v)} />
            <Label htmlFor="np-ignorar-estoque" className="text-sm font-normal cursor-pointer">Lançamento retroativo (ignorar estoque)</Label>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Processando..." : "Registrar Pedido"}
          </Button>
        </CardContent>
      </Card>

      <ReciboVenda open={reciboOpen} onOpenChange={setReciboOpen} data={reciboData} />
    </div>
  );
}
