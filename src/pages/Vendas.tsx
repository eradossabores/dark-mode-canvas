import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { Plus, Trash2, ShoppingCart, Pencil, Eye, CalendarIcon } from "lucide-react";

const FORMAS_PAGAMENTO = [
  { value: "amostra", label: "Amostra (Grátis)" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "parcelado", label: "Parcelado" },
  { value: "fiado", label: "Fiado" },
];

const TOP_SABORES = ["melancia", "morango", "maca verde", "maracuja", "agua de coco"];

function normalizeStr(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[çÇ]/g, "c");
}

export default function Vendas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteFilter = searchParams.get("cliente") || "";
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [numeroNf, setNumeroNf] = useState("");
  const [itens, setItens] = useState<{ sabor_id: string; quantidade: number; preco_unitario: string; preco_auto: boolean }[]>([]);
  const [dataVenda, setDataVenda] = useState<Date>(new Date());
  const [valorTotal, setValorTotal] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [valorRestante, setValorRestante] = useState("");
  const [ignorarEstoque, setIgnorarEstoque] = useState(false);
  const [statusVenda, setStatusVenda] = useState("pendente");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
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

  // Detail state
  const [detailVenda, setDetailVenda] = useState<any>(null);
  const [detailItens, setDetailItens] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [c, s, v, vi] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome").eq("status", "ativo").order("nome"),
      (supabase as any).from("sabores").select("*").eq("ativo", true).order("nome"),
      (supabase as any).from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("venda_itens").select("venda_id, quantidade"),
    ]);
    setClientes(c.data || []);
    setSabores(s.data || []);
    // Build units map per venda
    const unitsMap: Record<string, number> = {};
    (vi.data || []).forEach((it: any) => {
      unitsMap[it.venda_id] = (unitsMap[it.venda_id] || 0) + it.quantidade;
    });
    setVendas((v.data || []).map((vd: any) => ({ ...vd, totalUnidades: unitsMap[vd.id] || 0 })));
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
    const itensValidos = itens.filter(i => i.sabor_id && i.quantidade > 0);
    if (itensValidos.length === 0) return toast({ title: "Adicione ao menos um gelo com quantidade", variant: "destructive" });
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });

    setLoading(true);
    try {
      const toLocalDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const parcelasData = formaPagamento === "parcelado" && valorEntrada
        ? [
            { valor: Number(valorEntrada), vencimento: toLocalDateStr(dataVenda) },
            ...(Number(valorRestante) > 0 ? [{ valor: Number(valorRestante), vencimento: toLocalDateStr(new Date(dataVenda.getTime() + 30 * 86400000)) }] : []),
          ]
        : undefined;

      await realizarVenda({
        p_cliente_id: clienteId, p_operador: "sistema",
        p_observacoes: observacoes
          ? `[${formaPagamento}]${formaPagamento === "parcelado" && valorTotal ? ` Valor: R$${valorTotal} | Entrada: R$${valorEntrada} | Restante: R$${valorRestante}` : ""} ${observacoes}`
          : `[${formaPagamento}]${formaPagamento === "parcelado" && valorTotal ? ` Valor: R$${valorTotal} | Entrada: R$${valorEntrada} | Restante: R$${valorRestante}` : ""}`,
        p_itens: itensValidos,
        ...(parcelasData ? { p_parcelas: parcelasData } : {}),
        p_ignorar_estoque: ignorarEstoque,
      });

      const { data: latestVenda } = await (supabase as any)
        .from("vendas").select("id").eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }).limit(1);
      if (latestVenda?.[0]) {
        const updateData: any = { forma_pagamento: formaPagamento, status: statusVenda };
        if (numeroNf.trim()) updateData.numero_nf = numeroNf.trim();
        await (supabase as any).from("vendas").update(updateData).eq("id", latestVenda[0].id);
      }

      // Atualizar a data se diferente de hoje
      const hoje = new Date();
      if (dataVenda.toDateString() !== hoje.toDateString()) {
        const { data: latestVendaData } = await (supabase as any)
          .from("vendas").select("id").eq("cliente_id", clienteId)
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
      setOpen(false); setItens([]); setClienteId(""); setFormaPagamento("dinheiro"); setObservacoes(""); setNumeroNf(""); setDataVenda(new Date()); setValorTotal(""); setValorEntrada(""); setValorRestante(""); setIgnorarEstoque(false); setStatusVenda("pendente");
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
    // Load items
    const { data } = await (supabase as any).from("venda_itens").select("*, sabores(nome)").eq("venda_id", v.id);
    setEditItens((data || []).map((it: any) => ({ ...it, quantidade: it.quantidade })));
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editVenda) return;
    try {
      // Update venda header
      const { error } = await (supabase as any).from("vendas").update({
        status: editStatus, forma_pagamento: editForma, observacoes: editObs, numero_nf: editNf.trim() || null,
        created_at: `${editData.getFullYear()}-${String(editData.getMonth() + 1).padStart(2, "0")}-${String(editData.getDate()).padStart(2, "0")}T12:00:00`,
      }).eq("id", editVenda.id);
      if (error) throw error;

      // Update existing items and insert new ones
      let newTotal = 0;
      for (const item of editItens) {
        const subtotal = Number(item.preco_unitario) * item.quantidade;
        newTotal += subtotal;
        if (item.isNew) {
          if (!item.sabor_id || item.quantidade <= 0) continue;
          const { error: insertError } = await (supabase as any).from("venda_itens").insert({
            venda_id: editVenda.id,
            sabor_id: item.sabor_id,
            quantidade: item.quantidade,
            preco_unitario: Number(item.preco_unitario),
            subtotal: subtotal,
            regra_preco_aplicada: "manual",
          });
          if (insertError) {
            console.error("Erro ao inserir item:", insertError);
            throw insertError;
          }
        } else {
          await (supabase as any).from("venda_itens").update({
            quantidade: item.quantidade,
            preco_unitario: Number(item.preco_unitario),
            subtotal: subtotal,
          }).eq("id", item.id);
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

  function getFormaPagamentoLabel(v: any) {
    if (v.forma_pagamento) return FORMAS_PAGAMENTO.find(f => f.value === v.forma_pagamento)?.label || v.forma_pagamento;
    const match = v.observacoes?.match(/^\[([^\]]+)\]/);
    return match ? match[1] : "-";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
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
                  <div key={i} className="flex gap-2 mb-2 items-center">
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
                      <span>Total da Venda:</span>
                      <span className="text-lg">R$ {itens.reduce((sum, item) => sum + (Number(item.preco_unitario) || 0) * (item.quantidade || 0), 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={(v) => { setFormaPagamento(v); if (v !== "parcelado") { setValorTotal(""); setValorEntrada(""); setValorRestante(""); } }}>
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
              {formaPagamento === "parcelado" && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
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
                </div>
              )}
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Histórico de Vendas</CardTitle>
            {clienteFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">Filtro: {clienteFilter}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>Limpar filtro</Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
                const filtered = clienteFilter
                  ? vendas.filter(v => normalizeStr(v.clientes?.nome || "").includes(normalizeStr(clienteFilter)))
                  : vendas;
                if (filtered.length === 0) return (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma venda{clienteFilter ? ` para "${clienteFilter}"` : ""}.</TableCell></TableRow>
                );
                return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((v) => (
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
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openDetailDialog(v)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(v)}><Pencil className="h-4 w-4" /></Button>
                      {v.status !== "cancelada" && (
                        <Button size="icon" variant="ghost" onClick={() => setCancelId(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
          {(() => {
            const filtered = clienteFilter
              ? vendas.filter(v => normalizeStr(v.clientes?.nome || "").includes(normalizeStr(clienteFilter)))
              : vendas;
            if (filtered.length > PAGE_SIZE) return (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            );
            return null;
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
