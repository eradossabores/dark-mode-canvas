import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { realizarVenda } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, ShoppingCart, Pencil, Eye, CalendarIcon, X, Truck, Package, History, CalendarClock, Receipt } from "lucide-react";
import ReciboVenda from "@/components/vendas/ReciboVenda";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

export default function Vendas() {
  const { factoryId, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteFilter = searchParams.get("cliente") || "";
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [prodDialog, setProdDialog] = useState<{ venda: any; tipo: "entrega" | "retirada" } | null>(null);
  const [prodHora, setProdHora] = useState("");
  const [prodEmbalagem, setProdEmbalagem] = useState("1 saco");

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
  const [ignorarEstoque, setIgnorarEstoque] = useState(false);
  const [statusVenda, setStatusVenda] = useState("pendente");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detalhePgto, setDetalhePgto] = useState<"pix" | "especie" | "misto">("especie");
  const [detalhePix, setDetalhePix] = useState("");
  const [detalheEspecie, setDetalheEspecie] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [brindeQtd, setBrindeQtd] = useState("");
  const [brindeSaborId, setBrindeSaborId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchCliente, setSearchCliente] = useState("");
  const [filtroData, setFiltroData] = useState("ultimo_mes");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPagamento, setFiltroPagamento] = useState("todos");
  const PAGE_SIZE = 20;

  // Edit state
  const [editVenda, setEditVenda] = useState<any>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editForma, setEditForma] = useState("");
  const [editObs, setEditObs] = useState("");
  const [editNf, setEditNf] = useState("");
  const [editData, setEditData] = useState<Date>(new Date());
  const [editItens, setEditItens] = useState<any[]>([]);
  const [editIgnorarEstoque, setEditIgnorarEstoque] = useState(false);
  const [editDetalhePgto, setEditDetalhePgto] = useState<"pix" | "especie" | "misto">("especie");
  const [editDetalhePix, setEditDetalhePix] = useState("");
  const [editDetalheEspecie, setEditDetalheEspecie] = useState("");

  // Detail state
  const [detailVenda, setDetailVenda] = useState<any>(null);
  const [detailItens, setDetailItens] = useState<any[]>([]);
  const [historicoVenda, setHistoricoVenda] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [reciboData, setReciboData] = useState<any>(null);

  const filteredVendas = useMemo(() => {
    let filtered = vendas;
    if (clienteFilter) {
      filtered = filtered.filter(v => normalizeStr(v.clientes?.nome || "").includes(normalizeStr(clienteFilter)));
    }
    if (searchCliente.trim()) {
      filtered = filtered.filter(v => normalizeStr(v.clientes?.nome || "").includes(normalizeStr(searchCliente.trim())));
    }
    if (filtroStatus !== "todos") {
      filtered = filtered.filter(v => v.status === filtroStatus);
    }
    if (filtroPagamento !== "todos") {
      filtered = filtered.filter(v => v.forma_pagamento === filtroPagamento);
    }
    if (filtroData !== "todos") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);
      switch (filtroData) {
        case "hoje": start = startOfDay(now); break;
        case "semana": start = startOfWeek(now, { weekStartsOn: 1 }); break;
        case "este_mes": start = startOfMonth(now); break;
        case "ultimo_mes": start = startOfMonth(subMonths(now, 1)); break;
        case "ultimos_3m": start = startOfMonth(subMonths(now, 3)); break;
        default: start = new Date(0);
      }
      if (filtroData === "ultimo_mes") {
        // Include current month too
        end = endOfDay(now);
      }
      filtered = filtered.filter(v => {
        const d = new Date(v.created_at);
        return !isBefore(d, start) && !isAfter(d, end);
      });
    }
    return filtered;
  }, [vendas, clienteFilter, searchCliente, filtroStatus, filtroPagamento, filtroData]);

  useEffect(() => {
    if (role !== "super_admin" && !factoryId) {
      setClientes([]);
      setSabores([]);
      setVendas([]);
      return;
    }

    loadData();
  }, [factoryId, role]);

  async function loadHistorico(vendaId: string) {
    const { data } = await (supabase as any)
      .from("abatimentos_historico")
      .select("*")
      .eq("venda_id", vendaId)
      .order("created_at", { ascending: true });
    setHistorico(data || []);
  }

  async function openRecibo(v: any) {
    const { data: itensData } = await (supabase as any)
      .from("venda_itens").select("*, sabores(nome)").eq("venda_id", v.id);
    const { data: clienteData } = await (supabase as any)
      .from("clientes").select("telefone").eq("id", v.cliente_id).single();
    setReciboData({
      cliente_nome: v.clientes?.nome || "?",
      data: new Date(v.created_at).toLocaleDateString("pt-BR"),
      forma_pagamento: getFormaPagamentoLabel(v),
      numero_nf: v.numero_nf || undefined,
      total: Number(v.total),
      observacoes: (v.observacoes || "").replace(/^\[[^\]]*\]\s*/, "").trim() || undefined,
      telefone: clienteData?.telefone || undefined,
      status: v.status,
      valor_pago: Number(v.valor_pago || 0),
      itens: (itensData || []).map((it: any) => ({
        sabor_nome: it.sabores?.nome || "?",
        quantidade: it.quantidade,
        preco_unitario: Number(it.preco_unitario),
        subtotal: Number(it.subtotal),
      })),
    });
    setReciboOpen(true);
  }

  async function loadData() {
    if (role !== "super_admin" && !factoryId) {
      setClientes([]);
      setSabores([]);
      setVendas([]);
      return;
    }

    let cQ = (supabase as any).from("clientes").select("id, nome").eq("status", "ativo").order("nome");
    let sQ = (supabase as any).from("sabores").select("*").eq("ativo", true).order("nome");
    let vQ = (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }).limit(500);
    let viQ = (supabase as any).from("venda_itens").select("venda_id, quantidade");
    let ppQ = (supabase as any).from("pedidos_producao").select("venda_id, status, tipo_pedido").not("venda_id", "is", null);
    if (factoryId) { cQ = cQ.eq("factory_id", factoryId); sQ = sQ.eq("factory_id", factoryId); vQ = vQ.eq("factory_id", factoryId); viQ = viQ.eq("factory_id", factoryId); ppQ = ppQ.eq("factory_id", factoryId); }
    const [c, s, v, vi, pp] = await Promise.all([cQ, sQ, vQ, viQ, ppQ]);
    setClientes(c.data || []);
    setSabores(s.data || []);
    // Build units map per venda
    const unitsMap: Record<string, number> = {};
    (vi.data || []).forEach((it: any) => {
      unitsMap[it.venda_id] = (unitsMap[it.venda_id] || 0) + it.quantidade;
    });
    // Build pedido status map per venda
    const pedidoStatusMap: Record<string, string> = {};
    const pedidoTipoMap: Record<string, string> = {};
    (pp.data || []).forEach((p: any) => {
      if (p.venda_id) {
        pedidoStatusMap[p.venda_id] = p.status;
        pedidoTipoMap[p.venda_id] = p.tipo_pedido;
      }
    });
    setVendas((v.data || []).map((vd: any) => ({ ...vd, totalUnidades: unitsMap[vd.id] || 0, pedido_status: pedidoStatusMap[vd.id] || null, pedido_tipo: pedidoTipoMap[vd.id] || null })));
  }

  function addItem() { setItens([...itens, { sabor_id: "", quantidade: 1, preco_unitario: "", preco_auto: false }]); }
  function removeItem(i: number) { setItens(itens.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, val: any) {
    const list = [...itens];
    if (field === "quantidade") (list[i] as any)[field] = Number(val);
    else if (field === "preco_unitario") { list[i].preco_unitario = val; list[i].preco_auto = false; }
    else (list[i] as any)[field] = val;
    setItens(list);
    // Recalcular preço de TODOS os itens usando quantidade total da comanda
    if ((field === "sabor_id" || field === "quantidade") && clienteId) {
      recalcPrecosTotalComanda(list, clienteId);
    }
  }

  async function recalcPrecosTotalComanda(currentItens: typeof itens, cId: string) {
    const totalQtd = currentItens.reduce((s, it) => s + (it.quantidade || 0), 0);
    const updated = [...currentItens];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].sabor_id && updated[i].quantidade > 0) {
        const preco = await fetchPreco(cId, updated[i].sabor_id, totalQtd);
        if (preco !== null) { updated[i].preco_unitario = preco.toFixed(2); updated[i].preco_auto = true; }
      }
    }
    setItens(updated);
  }

  async function fetchPreco(cId: string, sId: string, qtd: number): Promise<number | null> {
    try {
      const { data, error } = await supabase.rpc("calcular_preco" as any, { p_cliente_id: cId, p_sabor_id: sId, p_quantidade: qtd });
      if (error) return null;
      return data as number;
    } catch { return null; }
  }

  // Recalcular preços quando cliente muda
  async function recalcPrecos(cId: string) {
    recalcPrecosTotalComanda(itens, cId);
  }

  async function handleSubmit() {
    let itensValidos = itens.filter(i => i.sabor_id && i.quantidade > 0);
    // Add brinde as free item
    if (Number(brindeQtd) > 0 && brindeSaborId) {
      itensValidos.push({ sabor_id: brindeSaborId, quantidade: Number(brindeQtd), preco_unitario: "0", preco_auto: false });
    }
    if (itensValidos.length === 0) return toast({ title: "Adicione ao menos um gelo com quantidade", variant: "destructive" });
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });

    setLoading(true);

    // Final price recalculation before submit to avoid race conditions
    const totalQtdFinal = itensValidos.reduce((s, it) => s + (it.quantidade || 0), 0);
    for (let i = 0; i < itensValidos.length; i++) {
      if (itensValidos[i].preco_auto !== false || !itensValidos[i].preco_unitario) {
        const preco = await fetchPreco(clienteId, itensValidos[i].sabor_id, totalQtdFinal);
        if (preco !== null) {
          itensValidos[i].preco_unitario = preco.toFixed(2);
          itensValidos[i].preco_auto = true;
        }
      }
    }
    try {
      const toLocalDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const vencimentoStr = dataVencimento
        ? toLocalDateStr(dataVencimento)
        : toLocalDateStr(new Date(dataVenda.getTime() + 30 * 86400000));
      const parcelasData = formaPagamento === "parcelado" && valorEntrada
        ? [
            { valor: Number(valorEntrada), vencimento: toLocalDateStr(dataVenda) },
            ...(Number(valorRestante) > 0 ? [{ valor: Number(valorRestante), vencimento: vencimentoStr }] : []),
          ]
        : formaPagamento === "boleto"
        ? [{ valor: itensValidos.reduce((s, i) => s + (Number(i.preco_unitario) || 0) * i.quantidade, 0), vencimento: vencimentoStr }]
        : undefined;

      const vencInfo = (formaPagamento === "boleto" || formaPagamento === "parcelado") && dataVencimento
        ? ` | Vencimento: ${format(dataVencimento, "dd/MM/yyyy")}`
        : "";
      const freteInfo = Number(valorFrete) > 0 ? ` | Frete: R$${Number(valorFrete).toFixed(2)}` : "";
      const brindeInfo = Number(brindeQtd) > 0 && brindeSaborId ? ` | Brinde: ${brindeQtd}un` : "";
      await realizarVenda({
        p_cliente_id: clienteId, p_operador: "sistema",
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
      if (latestVenda?.[0]) {
        const totalVendaCalc = itensValidos.reduce((s, i) => s + (Number(i.preco_unitario) || 0) * i.quantidade, 0) + (Number(valorFrete) || 0);
        const vPix = detalhePgto === "pix" ? totalVendaCalc : detalhePgto === "misto" ? (parseFloat(detalhePix.replace(",", ".")) || 0) : 0;
        const vEsp = detalhePgto === "especie" ? totalVendaCalc : detalhePgto === "misto" ? (parseFloat(detalheEspecie.replace(",", ".")) || 0) : 0;
        const updateData: any = { forma_pagamento: formaPagamento, status: statusVenda, valor_pix: vPix, valor_especie: vEsp };
        if (numeroNf.trim()) updateData.numero_nf = numeroNf.trim();
        await (supabase as any).from("vendas").update(updateData).eq("id", latestVenda[0].id);
      }

      // Atualizar a data se diferente de hoje
      const hoje = new Date();
      if (dataVenda.toDateString() !== hoje.toDateString()) {
        const { data: latestVendaData } = await (supabase as any)
          .from("vendas").select("id").eq("cliente_id", clienteId)
          .eq("factory_id", factoryId)
          .order("created_at", { ascending: false }).limit(1);
        if (latestVendaData?.[0]) {
          const localStr = `${dataVenda.getFullYear()}-${String(dataVenda.getMonth() + 1).padStart(2, "0")}-${String(dataVenda.getDate()).padStart(2, "0")}T12:00:00`;
          await (supabase as any).from("vendas").update({ created_at: localStr }).eq("id", latestVendaData[0].id);
        }
      }

      // Auditoria - lançamento de venda
      const clienteNome = clientes.find(c => c.id === clienteId)?.nome || "?";
      const totalVenda = itensValidos.reduce((s, i) => s + (Number(i.preco_unitario) || 0) * i.quantidade, 0);
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "vendas",
        acao: "venda_registrada",
        registro_afetado: latestVenda?.[0]?.id || null,
        descricao: `Venda para ${clienteNome} - R$ ${totalVenda.toFixed(2)} (${formaPagamento}) - ${itensValidos.length} item(ns)`,
      });

      toast({ title: "Venda registrada com sucesso!" });

      // Check if client has phone → offer WhatsApp receipt
      const clienteObj = clientes.find(c => c.id === clienteId);
      const vendaId = latestVenda?.[0]?.id;
      if (vendaId) {
        const { data: clienteFull } = await (supabase as any)
          .from("clientes").select("telefone").eq("id", clienteId).single();
        if (clienteFull?.telefone) {
          const { data: itensData } = await (supabase as any)
            .from("venda_itens").select("*, sabores(nome)").eq("venda_id", vendaId);
          setReciboData({
            cliente_nome: clienteObj?.nome || "?",
            data: dataVenda.toLocaleDateString("pt-BR"),
            forma_pagamento: FORMAS_PAGAMENTO.find(f => f.value === formaPagamento)?.label || formaPagamento,
            numero_nf: numeroNf.trim() || undefined,
            total: totalVenda,
            observacoes: observacoes || undefined,
            telefone: clienteFull.telefone,
            status: statusVenda as "pendente" | "paga" | "cancelada",
            valor_pago: statusVenda === "paga" ? totalVenda : (statusVenda === "pendente" ? 0 : totalVenda),
            itens: (itensData || []).map((it: any) => ({
              sabor_nome: it.sabores?.nome || "?",
              quantidade: it.quantidade,
              preco_unitario: Number(it.preco_unitario),
              subtotal: Number(it.subtotal),
            })),
          });
          setReciboOpen(true);
        }
      }

      setOpen(false); setItens([]); setClienteId(""); setFormaPagamento("dinheiro"); setObservacoes(""); setNumeroNf(""); setDataVenda(new Date()); setValorTotal(""); setValorEntrada(""); setValorRestante(""); setDataVencimento(undefined); setIgnorarEstoque(false); setStatusVenda("pendente"); setDetalhePgto("especie"); setDetalhePix(""); setDetalheEspecie("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro na venda", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function openEditDialog(v: any) {
    setEditVenda(v);
    setEditStatus(v.status);
    setEditForma(v.forma_pagamento || "dinheiro");
    setEditObs(v.observacoes || "");
    setEditNf(v.numero_nf || "");
    setEditData(new Date(v.created_at));
    // Payment detail
    const vPix = Number(v.valor_pix || 0);
    const vEsp = Number(v.valor_especie || 0);
    if (vPix > 0 && vEsp > 0) {
      setEditDetalhePgto("misto");
      setEditDetalhePix(vPix.toString());
      setEditDetalheEspecie(vEsp.toString());
    } else if (vPix > 0) {
      setEditDetalhePgto("pix");
      setEditDetalhePix(""); setEditDetalheEspecie("");
    } else {
      setEditDetalhePgto("especie");
      setEditDetalhePix(""); setEditDetalheEspecie("");
    }
    // Load items
    const { data } = await (supabase as any).from("venda_itens").select("*, sabores(nome)").eq("venda_id", v.id);
    setEditItens((data || []).map((it: any) => ({ ...it, quantidade: it.quantidade })));
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editVenda) return;
    try {
      // Se mudou de paga/cancelada para pendente, resetar valor_pago
      const editTotal = editItens.reduce((sum: number, it: any) => sum + Number(it.preco_unitario) * (it.quantidade || 0), 0);
      const eVPix = editDetalhePgto === "pix" ? editTotal : editDetalhePgto === "misto" ? (parseFloat(editDetalhePix.replace(",", ".")) || 0) : 0;
      const eVEsp = editDetalhePgto === "especie" ? editTotal : editDetalhePgto === "misto" ? (parseFloat(editDetalheEspecie.replace(",", ".")) || 0) : 0;
      const updateData: any = {
        status: editStatus, forma_pagamento: editForma, observacoes: editObs, numero_nf: editNf.trim() || null,
        created_at: `${editData.getFullYear()}-${String(editData.getMonth() + 1).padStart(2, "0")}-${String(editData.getDate()).padStart(2, "0")}T12:00:00`,
        valor_pix: eVPix, valor_especie: eVEsp,
      };
      if (editStatus === "pendente" && editVenda.status !== "pendente") {
        updateData.valor_pago = 0;
      }
      const { error } = await (supabase as any).from("vendas").update(updateData).eq("id", editVenda.id);
      if (error) throw error;

      // Update existing items and insert new ones
      let newTotal = 0;
      for (const item of editItens) {
        if (item.isNew) {
          if (!item.sabor_id || item.quantidade <= 0) continue;
          const subtotal = Number(item.preco_unitario) * item.quantidade;
          newTotal += subtotal;
          console.log("Inserindo novo item:", { venda_id: editVenda.id, sabor_id: item.sabor_id, quantidade: item.quantidade, preco_unitario: Number(item.preco_unitario), subtotal });
          const { data: insertedData, error: insertError } = await (supabase as any).from("venda_itens").insert({
            venda_id: editVenda.id,
            sabor_id: item.sabor_id,
            quantidade: item.quantidade,
            preco_unitario: Number(item.preco_unitario),
            subtotal: subtotal,
            regra_preco_aplicada: "manual",
          }).select();
          console.log("Resultado insert:", { insertedData, insertError });
          if (insertError) {
            console.error("Erro ao inserir item:", insertError);
            throw insertError;
          }
          if (!insertedData || insertedData.length === 0) {
            throw new Error("Item não foi salvo. Verifique as permissões do banco de dados.");
          }
        } else {
          const subtotal = Number(item.preco_unitario) * item.quantidade;
          newTotal += subtotal;
          const { error: updateError } = await (supabase as any).from("venda_itens").update({
            quantidade: item.quantidade,
            preco_unitario: Number(item.preco_unitario),
            subtotal: subtotal,
          }).eq("id", item.id);
          if (updateError) {
            console.error("Erro ao atualizar item:", updateError);
            throw updateError;
          }
        }
      }
      await (supabase as any).from("vendas").update({ total: newTotal }).eq("id", editVenda.id);

      toast({ title: "Venda atualizada!" });
      setEditOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function openDetailDialog(v: any) {
    setDetailVenda(v);
    const { data } = await (supabase as any).from("venda_itens").select("*, sabores(nome)").eq("venda_id", v.id);
    setDetailItens(data || []);
    setDetailOpen(true);
  }

  async function handleCancel() {
    if (!cancelId) return;
    try {
      const vendaCancelada = vendas.find(v => v.id === cancelId);
      const { error } = await (supabase as any).from("vendas").update({ status: "cancelada" }).eq("id", cancelId);
      if (error) throw error;

      // Auditoria - cancelamento
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "vendas",
        acao: "venda_cancelada",
        registro_afetado: cancelId,
        descricao: `Venda cancelada - Cliente: ${vendaCancelada?.clientes?.nome || "?"} - R$ ${Number(vendaCancelada?.total || 0).toFixed(2)}`,
      });

      toast({ title: "Venda cancelada!" });
      setCancelId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const vendaDeletada = vendas.find(v => v.id === deleteId);
      // Delete child records first (trigger on vendas handles stock reversal + movimentacoes)
      await (supabase as any).from("venda_itens").delete().eq("venda_id", deleteId);
      await (supabase as any).from("venda_parcelas").delete().eq("venda_id", deleteId);
      await (supabase as any).from("abatimentos_historico").delete().eq("venda_id", deleteId);
      const { error } = await (supabase as any).from("vendas").delete().eq("id", deleteId);
      if (error) throw error;

      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "vendas",
        acao: "venda_excluida",
        registro_afetado: deleteId,
        descricao: `Venda excluída permanentemente - Cliente: ${vendaDeletada?.clientes?.nome || "?"} - R$ ${Number(vendaDeletada?.total || 0).toFixed(2)}`,
      });

      toast({ title: "Venda excluída!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function getFormaPagamentoLabel(v: any) {
    if (v.forma_pagamento) return FORMAS_PAGAMENTO.find(f => f.value === v.forma_pagamento)?.label || v.forma_pagamento;
    const match = v.observacoes?.match(/^\[([^\]]+)\]/);
    return match ? match[1] : "-";
  }

  async function sendToProduction(venda: any, tipoPedido: "entrega" | "retirada") {
    if (sendingToProduction) return;
    setSendingToProduction(venda.id);
    try {
      // 1. Validate venda status
      const { data: freshVenda, error: fetchErr } = await (supabase as any)
        .from("vendas")
        .select("id, cliente_id, enviado_producao, status")
        .eq("id", venda.id)
        .single();
      if (fetchErr) throw fetchErr;

      if (freshVenda.enviado_producao) {
        toast({ title: "Este pedido já foi enviado para produção", variant: "destructive" });
        return;
      }
      if (freshVenda.status === "cancelada") {
        toast({ title: "Não é possível enviar uma venda cancelada para produção", variant: "destructive" });
        return;
      }

      // 2. Get venda items
      const { data: vendaItens, error: itensErr } = await (supabase as any)
        .from("venda_itens")
        .select("sabor_id, quantidade, sabores(nome)")
        .eq("venda_id", venda.id);
      if (itensErr) throw itensErr;

      if (!vendaItens || vendaItens.length === 0) {
        toast({ title: "Venda sem itens para enviar", variant: "destructive" });
        return;
      }

      // 3. Create pedido_producao
      const dataEntregaStr = prodDialog
        ? (() => {
            const base = new Date();
            if (prodHora) {
              const [h, m] = prodHora.split(":").map(Number);
              base.setHours(h, m, 0, 0);
            } else {
              base.setHours(base.getHours() + 2);
            }
            return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}T${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}:00`;
          })()
        : (() => {
            const now = new Date();
            const dataEntrega = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            return `${dataEntrega.getFullYear()}-${String(dataEntrega.getMonth() + 1).padStart(2, "0")}-${String(dataEntrega.getDate()).padStart(2, "0")}T${String(dataEntrega.getHours()).padStart(2, "0")}:${String(dataEntrega.getMinutes()).padStart(2, "0")}:00`;
          })();

      const embalagemEscolhida = prodDialog ? prodEmbalagem : "1 saco";

      const { data: pedido, error: pedidoErr } = await (supabase as any)
        .from("pedidos_producao")
        .insert({
          cliente_id: freshVenda.cliente_id,
          tipo_embalagem: embalagemEscolhida,
          data_entrega: dataEntregaStr,
          observacoes: `Gerado automaticamente da venda. Tipo: ${tipoPedido === "entrega" ? "Entrega" : "Retirada"}`,
          status: "aguardando_producao",
          status_pagamento: freshVenda.status === "paga" ? "pago" : "aguardando_pagamento",
          tipo_pedido: tipoPedido,
          venda_id: venda.id,
        })
        .select()
        .single();
      if (pedidoErr) throw pedidoErr;

      // 4. Create pedido items
      const itensBatch = vendaItens.map((i: any) => ({
        pedido_id: pedido.id,
        sabor_id: i.sabor_id,
        quantidade: i.quantidade,
      }));
      const { error: insertErr } = await (supabase as any).from("pedido_producao_itens").insert(itensBatch);
      if (insertErr) throw insertErr;

      // 5. Mark venda as sent
      await (supabase as any).from("vendas").update({ enviado_producao: true }).eq("id", venda.id);

      // 6. Auditoria
      const clienteNome = venda.clientes?.nome || "?";
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "vendas",
        acao: "enviar_producao",
        registro_afetado: venda.id,
        descricao: `Venda enviada para produção (${tipoPedido === "entrega" ? "Entrega" : "Retirada"}) - Cliente: ${clienteNome}`,
      });

      toast({
        title: tipoPedido === "entrega" ? "🚚 Enviado para Entrega!" : "🧊 Enviado para Retirada!",
        description: `Pedido criado no Monitor de Produção para ${clienteNome}`,
      });
      setProdDialog(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao enviar para produção", description: e.message, variant: "destructive" });
    } finally {
      setSendingToProduction(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Vendas</h1>
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v);
          if (v && itens.length === 0 && sabores.length > 0) {
            const preSelected = TOP_SABORES
              .map(name => sabores.find(s => normalizeStr(s.nome) === name || normalizeStr(s.nome).includes(name)))
              .filter(Boolean)
              .map(s => ({ sabor_id: s.id, quantidade: 0, preco_unitario: "", preco_auto: false }));
            if (preSelected.length > 0) setItens(preSelected);
          }
        }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Venda</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data da Venda</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !dataVenda && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataVenda ? format(dataVenda, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataVenda}
                      onSelect={(d) => {
                        if (d) setDataVenda(d);
                        setCalendarOpen(false);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div><Label>Cliente</Label>
                <Select value={clienteId} onValueChange={(v) => { setClienteId(v); recalcPrecos(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Gelos</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {itens.length === 0 && <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">Clique em "Add"</p>}
                {itens.map((item, i) => (
                  <div key={i} className={cn("flex gap-2 mb-2 items-center rounded-lg px-2 py-1.5 transition-colors", item.quantidade > 0 && "bg-secondary/60 ring-1 ring-secondary")}>
                    <Select value={item.sabor_id} onValueChange={(v) => updateItem(i, "sabor_id", v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor" /></SelectTrigger>
                      <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="w-20" min={1} value={item.quantidade || ""} onChange={(e) => updateItem(i, "quantidade", e.target.value)} placeholder="Qtd" />
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className={cn("pl-7 text-xs", item.preco_auto && "bg-muted/50")}
                        value={item.preco_unitario}
                        onChange={(e) => updateItem(i, "preco_unitario", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                {itens.length > 0 && (
                  <div className="mt-3 pt-3 border-t font-semibold space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Total de Gelos:</span>
                      <span className="text-lg">{itens.reduce((sum, item) => sum + (item.quantidade || 0), 0)} un.</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Subtotal Produtos:</span>
                      <span>R$ {itens.reduce((sum, item) => sum + (Number(item.preco_unitario) || 0) * (item.quantidade || 0), 0).toFixed(2)}</span>
                    </div>
                    {Number(valorFrete) > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span>Frete:</span>
                        <span>R$ {Number(valorFrete).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span>Total da Venda:</span>
                      <span className="text-lg">R$ {(itens.reduce((sum, item) => sum + (Number(item.preco_unitario) || 0) * (item.quantidade || 0), 0) + (Number(valorFrete) || 0)).toFixed(2)}</span>
                    </div>
                    {Number(brindeQtd) > 0 && brindeSaborId && (
                      <div className="flex justify-between items-center text-sm text-emerald-600">
                        <span>🎁 Brinde:</span>
                        <span>+{brindeQtd} un ({sabores.find(s => s.id === brindeSaborId)?.nome || "?"})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={(v) => { setFormaPagamento(v); if (v !== "parcelado") { setValorTotal(""); setValorEntrada(""); setValorRestante(""); } if (v !== "boleto" && v !== "parcelado") { setDataVencimento(undefined); } }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
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
                    <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="nv-pix" /><Label htmlFor="nv-pix" className="text-xs cursor-pointer">PIX</Label></div>
                    <div className="flex items-center gap-1.5"><RadioGroupItem value="especie" id="nv-esp" /><Label htmlFor="nv-esp" className="text-xs cursor-pointer">Espécie</Label></div>
                    <div className="flex items-center gap-1.5"><RadioGroupItem value="misto" id="nv-mix" /><Label htmlFor="nv-mix" className="text-xs cursor-pointer">Misto</Label></div>
                  </RadioGroup>
                  {detalhePgto === "misto" && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">PIX (R$)</Label>
                        <Input type="text" inputMode="decimal" placeholder="0,00" value={detalhePix} onChange={(e) => setDetalhePix(e.target.value)} />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Espécie (R$)</Label>
                        <Input type="text" inputMode="decimal" placeholder="0,00" value={detalheEspecie} onChange={(e) => setDetalheEspecie(e.target.value)} />
                      </div>
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
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !dataVencimento && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data de vencimento"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataVencimento}
                          onSelect={(d) => {
                            if (d) setDataVencimento(d);
                            setCalendarVencOpen(false);
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {formaPagamento === "parcelado" && (
                    <>
                      <div>
                        <Label>Valor Total (R$)</Label>
                        <Input type="number" step="0.01" min="0" value={valorTotal} onChange={(e) => {
                          setValorTotal(e.target.value);
                          const total = Number(e.target.value) || 0;
                          const entrada = Number(valorEntrada) || 0;
                          setValorRestante((total - entrada).toFixed(2));
                        }} placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Valor da Entrada (R$)</Label>
                        <Input type="number" step="0.01" min="0" value={valorEntrada} onChange={(e) => {
                          setValorEntrada(e.target.value);
                          const total = Number(valorTotal) || 0;
                          const entrada = Number(e.target.value) || 0;
                          setValorRestante((total - entrada).toFixed(2));
                        }} placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Valor Restante (R$)</Label>
                        <Input type="number" step="0.01" value={valorRestante} readOnly className="bg-muted" />
                      </div>
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
                  <Input type="number" step="0.01" min="0" className="pl-7" value={valorFrete} onChange={(e) => setValorFrete(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              {/* Brinde */}
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <Label className="text-xs font-medium">🎁 Brinde (opcional)</Label>
                <div className="flex gap-2">
                  <Select value={brindeSaborId} onValueChange={setBrindeSaborId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor do brinde" /></SelectTrigger>
                    <SelectContent>{sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={0} className="w-20" value={brindeQtd} onChange={(e) => setBrindeQtd(e.target.value)} placeholder="Qtd" />
                </div>
              </div>
              <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
              <div className="flex items-center space-x-2">
                <Checkbox id="ignorar-estoque" checked={ignorarEstoque} onCheckedChange={(v) => setIgnorarEstoque(!!v)} />
                <Label htmlFor="ignorar-estoque" className="text-sm font-normal cursor-pointer">Lançamento retroativo (ignorar estoque)</Label>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>{loading ? "Processando..." : "Registrar Venda"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Venda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data da Venda</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(editData, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editData} onSelect={(d) => d && setEditData(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Forma de Pagamento</Label>
              <Select value={editForma} onValueChange={setEditForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label className="text-xs font-medium">Detalhe do pagamento</Label>
              <RadioGroup value={editDetalhePgto} onValueChange={(v: any) => setEditDetalhePgto(v)} className="flex gap-3">
                <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="ed-pix" /><Label htmlFor="ed-pix" className="text-xs cursor-pointer">PIX</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="especie" id="ed-esp" /><Label htmlFor="ed-esp" className="text-xs cursor-pointer">Espécie</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="misto" id="ed-mix" /><Label htmlFor="ed-mix" className="text-xs cursor-pointer">Misto</Label></div>
              </RadioGroup>
              {editDetalhePgto === "misto" && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">PIX (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00" value={editDetalhePix} onChange={(e) => setEditDetalhePix(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Espécie (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00" value={editDetalheEspecie} onChange={(e) => setEditDetalheEspecie(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Itens da Venda</Label>
                  <Button size="sm" variant="outline" onClick={() => setEditItens([...editItens, { id: null, sabor_id: "", sabores: null, quantidade: 1, preco_unitario: 0, isNew: true }])}>
                    <Plus className="h-3 w-3 mr-1" />Add Sabor
                  </Button>
                </div>
                {editItens.map((item, i) => (
                  <div key={item.id || `new-${i}`} className="flex gap-2 mb-2 items-center">
                    {item.isNew ? (
                      <Select value={item.sabor_id} onValueChange={(v) => {
                        const updated = [...editItens];
                        const sab = sabores.find((s: any) => s.id === v);
                        updated[i] = { ...updated[i], sabor_id: v, sabores: sab ? { nome: sab.nome } : null };
                        setEditItens(updated);
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Sabor" /></SelectTrigger>
                        <SelectContent>{sabores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <span className="flex-1 text-sm truncate">{item.sabores?.nome}</span>
                    )}
                    <Input
                      type="number"
                      className="w-20"
                      min={0}
                      value={item.quantidade}
                      onChange={(e) => {
                        const updated = [...editItens];
                        updated[i] = { ...updated[i], quantidade: Number(e.target.value) || 0 };
                        setEditItens(updated);
                      }}
                      placeholder="Qtd"
                    />
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7 text-xs"
                        value={item.preco_unitario}
                        onChange={(e) => {
                          const updated = [...editItens];
                          updated[i] = { ...updated[i], preco_unitario: Number(e.target.value) || 0 };
                          setEditItens(updated);
                        }}
                        placeholder="Unit."
                      />
                    </div>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7 text-xs"
                        value={(Number(item.preco_unitario) * (item.quantidade || 0)).toFixed(2)}
                        onChange={(e) => {
                          const totalItem = Number(e.target.value) || 0;
                          const qty = item.quantidade || 1;
                          const newUnit = qty > 0 ? totalItem / qty : 0;
                          const updated = [...editItens];
                          updated[i] = { ...updated[i], preco_unitario: Number(newUnit.toFixed(4)) };
                          setEditItens(updated);
                        }}
                        placeholder="Total"
                      />
                    </div>
                    {item.isNew && (
                      <Button size="icon" variant="ghost" onClick={() => setEditItens(editItens.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center mt-2 pt-2 border-t font-semibold text-sm">
                  <span>Novo Total:</span>
                  <span>R$ {editItens.reduce((sum, it) => sum + Number(it.preco_unitario) * (it.quantidade || 0), 0).toFixed(2)}</span>
                </div>
              </div>
            <div><Label>Observações</Label><Input value={editObs} onChange={(e) => setEditObs(e.target.value)} /></div>
            <div><Label>Nº NF</Label><Input value={editNf} onChange={(e) => setEditNf(e.target.value)} placeholder="Número da nota fiscal" /></div>
            <div className="flex items-center space-x-2">
              <Checkbox id="edit-ignorar-estoque" checked={editIgnorarEstoque} onCheckedChange={(v) => setEditIgnorarEstoque(!!v)} />
              <Label htmlFor="edit-ignorar-estoque" className="text-sm font-normal cursor-pointer">Lançamento retroativo (ignorar estoque)</Label>
            </div>
            <Button className="w-full" onClick={handleEditSave}>Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da Venda</DialogTitle></DialogHeader>
          {detailVenda && (
            <div className="space-y-3">
              <p><strong>Cliente:</strong> {detailVenda.clientes?.nome}</p>
              <p><strong>Data:</strong> {new Date(detailVenda.created_at).toLocaleDateString("pt-BR")}</p>
              <p><strong>Total:</strong> R$ {Number(detailVenda.total).toFixed(2)}</p>
              <p><strong>Status:</strong> {detailVenda.status}</p>
              <p><strong>Pagamento:</strong> {getFormaPagamentoLabel(detailVenda)}</p>
              {detailVenda.observacoes && <p><strong>Obs:</strong> {detailVenda.observacoes}</p>}
              {detailVenda.numero_nf && <p><strong>NF:</strong> {detailVenda.numero_nf}</p>}
              <Table>
                <TableHeader><TableRow><TableHead>Sabor</TableHead><TableHead>Qtd</TableHead><TableHead>Preço Un.</TableHead><TableHead>Subtotal</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detailItens.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.sabores?.nome}</TableCell>
                      <TableCell>{it.quantidade}</TableCell>
                      <TableCell>R$ {Number(it.preco_unitario).toFixed(2)}</TableCell>
                      <TableCell>R$ {Number(it.subtotal).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm */}
      <AlertDialog open={!!cancelId} onOpenChange={(v) => !v && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda?</AlertDialogTitle>
            <AlertDialogDescription>A venda será marcada como cancelada. Esta ação não reverte o estoque automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancelar Venda</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível. A venda e todos os seus itens serão removidos do sistema.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Card de Encomendas */}
      {(() => {
        const hoje = new Date();
        hoje.setHours(23, 59, 59, 999);
        const encomendas = vendas.filter(v => new Date(v.created_at) > hoje && v.status !== "cancelada");
        if (encomendas.length === 0) return null;
        return (
          <Card className="mb-6 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-600" />
                📦 Encomendas ({encomendas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {encomendas.map(v => (
                  <div key={v.id} className="rounded-lg border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{v.clientes?.nome}</span>
                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                        {new Date(v.created_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{v.totalUnidades || 0} un · {getFormaPagamentoLabel(v)}</span>
                      <span className="font-bold">R$ {Number(v.total).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant={v.status === "paga" ? "default" : "secondary"} className="text-xs">{v.status}</Badge>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDetailDialog(v)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader className="px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">Histórico de Vendas</CardTitle>
            {clienteFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs sm:text-sm">Filtro: {clienteFilter}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>Limpar filtro</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-3">
            <Input
              placeholder="Pesquisar cliente..."
              value={searchCliente}
              onChange={(e) => { setSearchCliente(e.target.value); setPage(0); }}
              className="col-span-2 sm:max-w-[200px] h-9 text-sm"
            />
            <Select value={filtroData} onValueChange={(v) => { setFiltroData(v); setPage(0); }}>
              <SelectTrigger className="h-9 text-xs sm:text-sm sm:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as datas</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="este_mes">Este mês</SelectItem>
                <SelectItem value="ultimo_mes">Último mês</SelectItem>
                <SelectItem value="ultimos_3m">Últimos 3 meses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(0); }}>
              <SelectTrigger className="h-9 text-xs sm:text-sm sm:w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroPagamento} onValueChange={(v) => { setFiltroPagamento(v); setPage(0); }}>
              <SelectTrigger className="col-span-2 sm:col-span-1 h-9 text-xs sm:text-sm sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos pagamentos</SelectItem>
                {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {(() => {
            if (filteredVendas.length > PAGE_SIZE) return (
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredVendas.length)} de {filteredVendas.length}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= filteredVendas.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            );
            return null;
          })()}

          {/* Mobile card view */}
          <div className="block md:hidden space-y-3">
            {filteredVendas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma venda{clienteFilter ? ` para "${clienteFilter}"` : ""}.</p>
            ) : (
              filteredVendas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((v) => (
                <div key={v.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate max-w-[60%]">{v.clientes?.nome}</span>
                    <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"} className="text-[10px]">{v.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(v.created_at).toLocaleDateString("pt-BR")}</span>
                    <span>{v.totalUnidades || 0} un · {getFormaPagamentoLabel(v)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">R$ {Number(v.total).toFixed(2)}</span>
                    {v.enviado_producao && (
                      <Badge variant="outline" className={`text-[10px] ${
                        v.pedido_status === "retirado" || v.pedido_status === "enviado"
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-green-500/10 text-green-700 border-green-300"
                      }`}>
                        {v.pedido_status === "enviado" ? "Entregue" : v.pedido_status === "retirado" ? "Retirado" : "No Monitor"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t">
                    {v.status !== "cancelada" && !v.enviado_producao && (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-600" disabled={sendingToProduction === v.id}
                          onClick={() => { setProdHora(""); setProdEmbalagem("1 saco"); setProdDialog({ venda: v, tipo: "entrega" }); }}>
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600" disabled={sendingToProduction === v.id}
                          onClick={() => { setProdHora(""); setProdEmbalagem("1 saco"); setProdDialog({ venda: v, tipo: "retirada" }); }}>
                          <Package className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setHistoricoVenda(v); loadHistorico(v.id); }}><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDetailDialog(v)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openRecibo(v)}><Receipt className="h-4 w-4 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(v)}><Pencil className="h-4 w-4" /></Button>
                    <div className="ml-auto flex gap-1">
                      {v.status !== "cancelada" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCancelId(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteId(v.id)}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                if (filteredVendas.length === 0) return (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma venda{clienteFilter ? ` para "${clienteFilter}"` : ""}.</TableCell></TableRow>
                );
                return filteredVendas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{v.clientes?.nome}</TableCell>
                    <TableCell className="text-right font-medium">{v.totalUnidades || 0}</TableCell>
                    <TableCell>R$ {Number(v.total).toFixed(2)}</TableCell>
                    <TableCell>{getFormaPagamentoLabel(v)}</TableCell>
                    <TableCell>{v.numero_nf || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <TooltipProvider delayDuration={300}>
                          {v.status !== "cancelada" && !v.enviado_producao && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950"
                                    disabled={sendingToProduction === v.id}
                                    onClick={() => { setProdHora(""); setProdEmbalagem("1 saco"); setProdDialog({ venda: v, tipo: "entrega" }); }}>
                                    <Truck className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar para Entrega</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                                    disabled={sendingToProduction === v.id}
                                    onClick={() => { setProdHora(""); setProdEmbalagem("1 saco"); setProdDialog({ venda: v, tipo: "retirada" }); }}>
                                    <Package className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar para Retirada</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {v.enviado_producao && (
                            <Badge variant="outline" className={`text-[10px] mr-1 ${
                              v.pedido_status === "retirado" || v.pedido_status === "enviado"
                                ? "bg-muted text-muted-foreground border-border"
                                : "bg-green-500/10 text-green-700 border-green-300"
                            }`}>
                              {v.pedido_status === "enviado" ? "Entregue" : v.pedido_status === "retirado" ? "Retirado" : "No Monitor"}
                            </Badge>
                          )}
                        </TooltipProvider>
                        <Button size="icon" variant="ghost" onClick={() => { setHistoricoVenda(v); loadHistorico(v.id); }}><History className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openDetailDialog(v)}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openRecibo(v)}><Receipt className="h-4 w-4 text-emerald-600" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(v)}><Pencil className="h-4 w-4" /></Button>
                        {v.status !== "cancelada" && (
                          <Button size="icon" variant="ghost" onClick={() => setCancelId(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(v.id)}><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
          </div>
          {filteredVendas.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredVendas.length)} de {filteredVendas.length}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= filteredVendas.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de enviar para produção com hora e embalagem */}
      <Dialog open={!!prodDialog} onOpenChange={(v) => !v && setProdDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {prodDialog?.tipo === "entrega" ? "🚚 Enviar para Entrega" : "🧊 Enviar para Retirada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Horário da {prodDialog?.tipo === "entrega" ? "Entrega" : "Retirada"} *</Label>
              <Input type="time" value={prodHora} onChange={(e) => setProdHora(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de Embalagem</Label>
              <Select value={prodEmbalagem} onValueChange={setProdEmbalagem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1 saco">1 Saco</SelectItem>
                  <SelectItem value="2 sacos">2 Sacos</SelectItem>
                  <SelectItem value="sacola_alca">Sacola com Alça</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!prodHora || sendingToProduction === prodDialog?.venda?.id}
              onClick={() => {
                if (prodDialog) sendToProduction(prodDialog.venda, prodDialog.tipo);
              }}
            >
              Confirmar e Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico de Abatimentos */}
      <Dialog open={!!historicoVenda} onOpenChange={(open) => { if (!open) setHistoricoVenda(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de Abatimentos</DialogTitle>
          </DialogHeader>
          {historicoVenda && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">{historicoVenda.clientes?.nome}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total da venda:</span>
                  <span className="font-bold text-foreground">R$ {Number(historicoVenda.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Valor pago:</span>
                  <span className="font-bold text-foreground">R$ {Number(historicoVenda.valor_pago || 0).toFixed(2)}</span>
                </div>
              </div>

              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum abatimento registrado.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historico.map((h, i) => (
                    <div key={h.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-muted-foreground">Abatimento #{i + 1}</p>
                      </div>
                      <span className="font-bold text-green-600">R$ {Number(h.valor).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                    <span>Total abatido:</span>
                    <span className="text-green-600">
                      R$ {historico.reduce((s: number, h: any) => s + Number(h.valor), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ReciboVenda open={reciboOpen} onOpenChange={setReciboOpen} data={reciboData} />
    </div>
  );
}
