import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Plus, Pencil, Trash2, Loader2, TrendingDown, Receipt, CircleDollarSign, AlertTriangle, Check, X, CalendarDays, BarChart3 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "especie", label: "Espécie" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "cheque", label: "Cheque" },
];

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface ContaPagar {
  id: string;
  descricao: string;
  responsavel: string | null;
  valor_parcela: number;
  parcela_atual: number;
  total_parcelas: number;
  tipo: "fixo" | "parcelado";
  valor_total: number;
  valor_restante: number;
  mes_referencia: string;
  ativa: boolean;
  pago_mes: boolean;
  proxima_parcela_data: string | null;
  created_at?: string;
}

export default function ContasAPagar() {
  const { factoryId, role } = useAuth();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null);
  const [pagarData, setPagarData] = useState<Date | undefined>(undefined);
  const [pagarForma, setPagarForma] = useState<string>("pix");
  const [pagarValor, setPagarValor] = useState("");

  // Form state
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [tipo, setTipo] = useState<"fixo" | "parcelado">("parcelado");
  const [valorTotal, setValorTotal] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [formaEntrada, setFormaEntrada] = useState("pix");
  const [pagamentosIntermediarios, setPagamentosIntermediarios] = useState<{ valor: string; forma: string; descricao: string }[]>([]);
  const [totalParcelas, setTotalParcelas] = useState("");
  const [valorParcela, setValorParcela] = useState("");

  // Edit state
  const [editId, setEditId] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editResponsavel, setEditResponsavel] = useState("");
  const [editValorParcela, setEditValorParcela] = useState("");
  const [editParcelaAtual, setEditParcelaAtual] = useState("");
  const [editTotalParcelas, setEditTotalParcelas] = useState("");
  const [editTipo, setEditTipo] = useState<"fixo" | "parcelado">("parcelado");
  const [editValorTotal, setEditValorTotal] = useState("");
  const [editValorRestante, setEditValorRestante] = useState("");

  useEffect(() => {
    if (role !== "super_admin" && !factoryId) { setContas([]); setLoading(false); return; }
    loadContas();
  }, [factoryId, role]);

  // Auto-calculate remaining and installment value
  const calcValorTotalNum = parseFloat(valorTotal || "0");
  const calcEntrada = parseFloat(valorEntrada || "0");
  const calcIntermediarios = pagamentosIntermediarios.reduce((s, p) => s + (parseFloat(p.valor || "0")), 0);
  const calcRestanteParaParcelar = Math.max(0, calcValorTotalNum - calcEntrada - calcIntermediarios);
  const calcTotalParcelas = parseInt(totalParcelas || "0");
  const calcValorParcela = calcTotalParcelas > 0 ? calcRestanteParaParcelar / calcTotalParcelas : 0;

  // Bar chart data - gastos mensais (Jan a Dez do ano atual)
  const chartData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const months: { name: string; total: number; fixo: number; parcelado: number; isCurrent: boolean; isFuture: boolean }[] = [];
    
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(currentYear, m, 1);
      const isCurrent = m === currentMonth;
      const isFuture = m > currentMonth;
      
      // Fixos always count for every month
      const fixoTotal = contas.filter(c => c.tipo === "fixo").reduce((s, c) => s + c.valor_parcela, 0);
      
      // Parcelados: count if created before or during this month and still has remaining parcels
      const parceladoTotal = contas.filter(c => {
        if (c.tipo !== "parcelado") return false;
        const created = new Date(c.created_at || "");
        const createdMonth = startOfMonth(created);
        const thisMonth = startOfMonth(monthDate);
        if (createdMonth > thisMonth) return false;
        // Estimate if parcels still remain for this month
        const monthsElapsed = (thisMonth.getFullYear() - createdMonth.getFullYear()) * 12 + (thisMonth.getMonth() - createdMonth.getMonth());
        return monthsElapsed < (c.total_parcelas || 1);
      }).reduce((s, c) => s + c.valor_parcela, 0);
      
      months.push({
        name: `${MESES_PT[m]}/${String(currentYear).slice(2)}`,
        total: fixoTotal + parceladoTotal,
        fixo: fixoTotal,
        parcelado: parceladoTotal,
        isCurrent,
        isFuture,
      });
    }
    
    return months;
  }, [contas]);

  async function loadContas() {
    setLoading(true);
    let q = (supabase as any)
      .from("contas_a_pagar").select("*").eq("ativa", true).order("created_at");
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data, error } = await q;
    if (error) { console.error(error); }
    setContas(data || []);
    setLoading(false);
  }

  function resetForm() {
    setDescricao(""); setResponsavel(""); setTipo("parcelado"); setValorTotal("");
    setValorEntrada(""); setFormaEntrada("pix"); setPagamentosIntermediarios([]);
    setTotalParcelas(""); setValorParcela("");
  }

  async function handleAdd() {
    if (!descricao) return toast({ title: "Preencha a descrição", variant: "destructive" });
    if (tipo === "parcelado" && !valorTotal) return toast({ title: "Preencha o valor total", variant: "destructive" });
    if (tipo === "fixo" && !valorParcela) return toast({ title: "Preencha o valor mensal", variant: "destructive" });

    setSaving(true);

    const vp = tipo === "parcelado" ? calcValorParcela : parseFloat(valorParcela || "0");
    const tp = tipo === "parcelado" ? calcTotalParcelas : 0;
    const vt = tipo === "parcelado" ? calcValorTotalNum : 0;
    const entradaPaga = calcEntrada + calcIntermediarios;
    const parcelasJaPagas = 0;
    const vr = tipo === "parcelado" ? calcRestanteParaParcelar : 0;

    let obs = "";
    if (calcEntrada > 0) {
      obs += `Entrada: R$${calcEntrada.toFixed(2)} (${FORMAS_PAGAMENTO.find(f => f.value === formaEntrada)?.label || formaEntrada})`;
    }
    if (pagamentosIntermediarios.length > 0) {
      const pagtos = pagamentosIntermediarios.filter(p => parseFloat(p.valor || "0") > 0);
      if (pagtos.length > 0) {
        obs += (obs ? " | " : "") + pagtos.map(p =>
          `${p.descricao || "Pgto"}: R$${parseFloat(p.valor).toFixed(2)} (${FORMAS_PAGAMENTO.find(f => f.value === p.forma)?.label || p.forma})`
        ).join(" | ");
      }
    }

    const { error } = await (supabase as any).from("contas_a_pagar").insert({
      descricao: obs ? `${descricao} — ${obs}` : descricao,
      responsavel: responsavel || null,
      valor_parcela: Math.round(vp * 100) / 100,
      parcela_atual: parcelasJaPagas,
      total_parcelas: tp,
      tipo,
      valor_total: vt,
      valor_restante: Math.max(0, Math.round(vr * 100) / 100),
      factory_id: factoryId,
    });
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Conta adicionada!" });
    setOpen(false); resetForm(); loadContas();
  }

  function openEdit(c: ContaPagar) {
    setEditId(c.id);
    setEditDescricao(c.descricao);
    setEditResponsavel(c.responsavel || "");
    setEditValorParcela(String(c.valor_parcela));
    setEditParcelaAtual(String(c.parcela_atual));
    setEditTotalParcelas(String(c.total_parcelas));
    setEditTipo(c.tipo);
    setEditValorTotal(String(c.valor_total));
    setEditValorRestante(String(c.valor_restante));
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editDescricao || !editValorParcela) return toast({ title: "Preencha descrição e valor", variant: "destructive" });
    setSaving(true);
    const vp = parseFloat(editValorParcela);
    const tp = editTipo === "parcelado" ? parseInt(editTotalParcelas || "0") : 0;
    const pa = editTipo === "parcelado" ? parseInt(editParcelaAtual || "0") : 0;
    const vt = editTipo === "parcelado" ? parseFloat(editValorTotal || "0") : 0;
    const vr = editTipo === "parcelado" ? parseFloat(editValorRestante || String(vp * (tp - pa))) : 0;
    const { error } = await (supabase as any).from("contas_a_pagar").update({
      descricao: editDescricao,
      responsavel: editResponsavel || null,
      valor_parcela: vp,
      parcela_atual: pa,
      total_parcelas: tp,
      tipo: editTipo,
      valor_total: vt,
      valor_restante: Math.max(0, vr),
    }).eq("id", editId);
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Conta atualizada!" });
    setEditOpen(false); loadContas();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await (supabase as any).from("contas_a_pagar").update({ ativa: false }).eq("id", deleteId);
    toast({ title: "Conta removida!" });
    setDeleteId(null); loadContas();
  }

  async function avancarParcela(c: ContaPagar, proximaData?: Date) {
    if (c.tipo !== "parcelado" || c.parcela_atual >= c.total_parcelas) return;
    const valorPago = parseFloat(pagarValor || String(c.valor_parcela));
    const novaParcela = c.parcela_atual + 1;
    const novoRestante = Math.max(0, c.valor_restante - valorPago);
    await (supabase as any).from("contas_a_pagar").update({
      parcela_atual: novaParcela,
      valor_restante: Math.round(novoRestante * 100) / 100,
      pago_mes: true,
      proxima_parcela_data: proximaData ? format(proximaData, "yyyy-MM-dd") : null,
    }).eq("id", c.id);
    toast({ title: `Parcela ${novaParcela}/${c.total_parcelas} paga! (${FORMAS_PAGAMENTO.find(f => f.value === pagarForma)?.label || pagarForma})` });
    setPagarConta(null);
    setPagarData(undefined);
    setPagarValor("");
    loadContas();
  }

  async function togglePagoMes(c: ContaPagar) {
    const novo = !c.pago_mes;
    await (supabase as any).from("contas_a_pagar").update({ pago_mes: novo }).eq("id", c.id);
    toast({ title: novo ? `✅ ${c.descricao.split(" — ")[0]} — parcela do mês marcada como paga` : `${c.descricao.split(" — ")[0]} — parcela do mês desmarcada` });
    loadContas();
  }

  const R = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fixas = contas.filter(c => c.tipo === "fixo");
  const parceladas = contas.filter(c => c.tipo === "parcelado");
  const totalMensal = contas.reduce((s, c) => s + c.valor_parcela, 0);
  const totalRestante = parceladas.reduce((s, c) => s + c.valor_restante, 0);
  const totalFixo = fixas.reduce((s, c) => s + c.valor_parcela, 0);
  const totalParcelado = parceladas.reduce((s, c) => s + c.valor_parcela, 0);
  const contasPagas = contas.filter(c => c.pago_mes).length;
  const contasPendentes = contas.filter(c => !c.pago_mes).length;

  function renderEditForm() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Descrição</Label>
            <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} placeholder="Ex: Freezer" />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={editResponsavel} onChange={e => setEditResponsavel(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={editTipo} onValueChange={v => setEditTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="fixo">Fixo (Mensal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor da Parcela</Label>
            <Input type="number" step="0.01" value={editValorParcela} onChange={e => setEditValorParcela(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        {editTipo === "parcelado" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parcela Atual</Label>
                <Input type="number" value={editParcelaAtual} onChange={e => setEditParcelaAtual(e.target.value)} placeholder="1" />
              </div>
              <div>
                <Label>Total de Parcelas</Label>
                <Input type="number" value={editTotalParcelas} onChange={e => setEditTotalParcelas(e.target.value)} placeholder="12" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total</Label>
                <Input type="number" step="0.01" value={editValorTotal} onChange={e => setEditValorTotal(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Valor Restante</Label>
                <Input type="number" step="0.01" value={editValorRestante} onChange={e => setEditValorRestante(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderNewForm() {
    return (
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Carro, Freezer, Máquina" />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="fixo">Fixo (Mensal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "fixo" && (
            <div>
              <Label>Valor Mensal</Label>
              <Input type="number" step="0.01" value={valorParcela} onChange={e => setValorParcela(e.target.value)} placeholder="0,00" />
            </div>
          )}
        </div>

        {tipo === "parcelado" && (
          <>
            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <Label className="text-sm font-bold">💰 1. Valor Total da Compra</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input type="number" step="0.01" className="pl-7 text-lg font-bold" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="40.000,00" />
              </div>
            </div>

            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <Label className="text-sm font-bold">💵 2. Entrada (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input type="number" step="0.01" className="pl-7" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} placeholder="10.000,00" />
                </div>
                <Select value={formaEntrada} onValueChange={setFormaEntrada}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">📝 3. Pagamentos Intermediários (opcional)</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-xs gap-1"
                  onClick={() => setPagamentosIntermediarios([...pagamentosIntermediarios, { valor: "", forma: "pix", descricao: "" }])}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Ex: Após 15 dias pagou mais R$10.000 no PIX</p>
              {pagamentosIntermediarios.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input type="number" step="0.01" className="pl-7" value={p.valor}
                      onChange={e => {
                        const list = [...pagamentosIntermediarios];
                        list[i].valor = e.target.value;
                        setPagamentosIntermediarios(list);
                      }} placeholder="Valor" />
                  </div>
                  <Select value={p.forma} onValueChange={v => {
                    const list = [...pagamentosIntermediarios];
                    list[i].forma = v;
                    setPagamentosIntermediarios(list);
                  }}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="w-[100px]" placeholder="Obs" value={p.descricao}
                    onChange={e => {
                      const list = [...pagamentosIntermediarios];
                      list[i].descricao = e.target.value;
                      setPagamentosIntermediarios(list);
                    }} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPagamentosIntermediarios(pagamentosIntermediarios.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <Label className="text-sm font-bold">📊 4. Parcelar o Restante</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nº de Parcelas</Label>
                  <Input type="number" value={totalParcelas} onChange={e => setTotalParcelas(e.target.value)} placeholder="12" />
                </div>
                <div>
                  <Label className="text-xs">Valor da Parcela</Label>
                  <Input type="number" step="0.01" value={calcValorParcela.toFixed(2)} disabled className="bg-muted font-mono" />
                </div>
              </div>
            </div>

            <div className="p-3 border-2 border-primary/30 rounded-lg bg-primary/5 space-y-2">
              <Label className="text-sm font-bold">📋 Resumo</Label>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>Valor Total:</span><span className="font-bold">{R(calcValorTotalNum)}</span></div>
                {calcEntrada > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>(-) Entrada ({FORMAS_PAGAMENTO.find(f => f.value === formaEntrada)?.label}):</span>
                    <span>{R(calcEntrada)}</span>
                  </div>
                )}
                {pagamentosIntermediarios.filter(p => parseFloat(p.valor || "0") > 0).map((p, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>(-) {p.descricao || "Pgto intermediário"} ({FORMAS_PAGAMENTO.find(f => f.value === p.forma)?.label}):</span>
                    <span>{R(parseFloat(p.valor))}</span>
                  </div>
                ))}
                <div className="border-t pt-1 flex justify-between font-bold">
                  <span>Restante a parcelar:</span>
                  <span className="text-destructive">{R(calcRestanteParaParcelar)}</span>
                </div>
                {calcTotalParcelas > 0 && (
                  <div className="flex justify-between text-primary font-medium">
                    <span>{calcTotalParcelas}x de:</span>
                    <span>{R(calcValorParcela)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-bold text-foreground mb-1">{label}</p>
          <p className="text-primary">Fixos: {R(payload[0]?.payload?.fixo || 0)}</p>
          <p className="text-destructive">Parcelados: {R(payload[0]?.payload?.parcelado || 0)}</p>
          <p className="font-bold text-foreground mt-1 border-t pt-1">Total: {R(payload[0]?.value || 0)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">{contas.length} conta(s) ativa(s) · {contasPendentes} pendente(s)</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
            {renderNewForm()}
            <Button className="w-full" onClick={handleAdd} disabled={saving}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs - Redesigned */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5 text-primary" /> Total Mensal
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalMensal)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{contas.length} conta(s)</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Saldo Devedor
            </div>
            <p className="text-xl font-bold text-destructive">{R(totalRestante)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{parceladas.length} parcelada(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CircleDollarSign className="h-3.5 w-3.5" /> Custos Fixos
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalFixo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fixas.length} fixa(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingDown className="h-3.5 w-3.5" /> Parcelas/Mês
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalParcelado)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{parceladas.length} conta(s)</p>
          </CardContent>
        </Card>
        <Card className={contasPendentes > 0 ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent" : "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent"}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {contasPendentes > 0 ? <X className="h-3.5 w-3.5 text-amber-500" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
              Status do Mês
            </div>
            <p className="text-xl font-bold text-foreground">{contasPagas}/{contas.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{contasPendentes > 0 ? `${contasPendentes} pendente(s)` : "Tudo pago! ✅"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Gastos Mensais (Últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis 
                  tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} 
                  tick={{ fontSize: 11 }} 
                  className="text-muted-foreground"
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isCurrent ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary/40" />
              Meses anteriores
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              Mês atual
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contas Parceladas */}
      {parceladas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                📋 Contas Parceladas
                <Badge variant="secondary" className="text-xs">{parceladas.length}</Badge>
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                Saldo total: <span className="font-bold text-destructive">{R(totalRestante)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Custo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Mês Pago?</TableHead>
                    <TableHead className="text-right">Parcela</TableHead>
                    <TableHead>Próx. Vencimento</TableHead>
                    <TableHead className="text-center">Progresso</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Faltam</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parceladas.map(c => {
                    const pct = c.total_parcelas > 0 ? Math.round((c.parcela_atual / c.total_parcelas) * 100) : 0;
                    const quaseQuitando = c.parcela_atual >= c.total_parcelas - 2 && c.parcela_atual < c.total_parcelas;
                    const quitado = c.parcela_atual >= c.total_parcelas;
                    const descParts = c.descricao.split(" — ");
                    return (
                      <TableRow key={c.id} className={quitado ? "opacity-60" : ""}>
                        <TableCell className="font-medium">
                          <div>{descParts[0]}</div>
                          {descParts[1] && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate">{descParts[1]}</p>}
                        </TableCell>
                        <TableCell className="text-sm">{c.responsavel || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={c.pago_mes ? "default" : "outline"}
                            className={cn(
                              "h-7 w-7 p-0 transition-all",
                              c.pago_mes ? "bg-green-600 hover:bg-green-700 shadow-sm" : "hover:bg-destructive/10"
                            )}
                            onClick={() => togglePagoMes(c)}
                            title={c.pago_mes ? "Parcela do mês paga ✅" : "Parcela do mês pendente"}
                          >
                            {c.pago_mes ? <Check className="h-4 w-4 text-white" /> : <X className="h-4 w-4 text-destructive" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{R(c.valor_parcela)}</TableCell>
                        <TableCell>
                          {c.proxima_parcela_data ? (
                            <Badge variant="outline" className="text-xs gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(c.proxima_parcela_data + "T12:00:00").toLocaleDateString("pt-BR")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={pct} className="h-2 flex-1" />
                            <Badge variant={quitado ? "default" : quaseQuitando ? "secondary" : "outline"} className="text-xs font-mono whitespace-nowrap">
                              {c.parcela_atual}/{c.total_parcelas}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{R(c.valor_total)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive text-sm">{R(c.valor_restante)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!quitado && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setPagarConta(c); setPagarData(undefined); setPagarValor(String(c.valor_parcela)); }} title="Pagar próxima parcela">
                                💰 Pagar
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(c.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTAL PARCELADAS</TableCell>
                    <TableCell className="text-right font-mono">{R(totalParcelado)}</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right font-mono">{R(parceladas.reduce((s, c) => s + c.valor_total, 0))}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{R(totalRestante)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custos Fixos */}
      {fixas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                🔁 Custos Fixos Mensais
                <Badge variant="secondary" className="text-xs">{fixas.length}</Badge>
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                Total mensal: <span className="font-bold">{R(totalFixo)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Custo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center">Mês Pago?</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.descricao.split(" — ")[0]}</TableCell>
                    <TableCell className="text-sm">{c.responsavel || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={c.pago_mes ? "default" : "outline"}
                        className={cn(
                          "h-7 w-7 p-0 transition-all",
                          c.pago_mes ? "bg-green-600 hover:bg-green-700 shadow-sm" : "hover:bg-destructive/10"
                        )}
                        onClick={() => togglePagoMes(c)}
                        title={c.pago_mes ? "Pago este mês ✅" : "Pendente este mês"}
                      >
                        {c.pago_mes ? <Check className="h-4 w-4 text-white" /> : <X className="h-4 w-4 text-destructive" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{R(c.valor_parcela)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>TOTAL FIXOS</TableCell>
                  <TableCell className="text-right font-mono">{R(totalFixo)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {contas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Nenhuma conta cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4">Clique em "Nova Conta" para adicionar sua primeira conta a pagar.</p>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
          {renderEditForm()}
          <Button className="w-full" onClick={handleEdit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Pagar Parcela Dialog */}
      <Dialog open={!!pagarConta} onOpenChange={v => { if (!v) { setPagarConta(null); setPagarData(undefined); setPagarForma("pix"); setPagarValor(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar Parcela</DialogTitle>
          </DialogHeader>
          {pagarConta && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-bold">{pagarConta.descricao.split(" — ")[0]}</p>
                <p className="text-xs text-muted-foreground">
                  Parcela {pagarConta.parcela_atual + 1}/{pagarConta.total_parcelas} · {R(pagarConta.valor_parcela)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Restante: <strong className="text-destructive">{R(pagarConta.valor_restante)}</strong>
                </p>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Valor do pagamento</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input type="number" step="0.01" className="pl-7" value={pagarValor} onChange={e => setPagarValor(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Forma de pagamento</Label>
                <Select value={pagarForma} onValueChange={setPagarForma}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Data da próxima parcela (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !pagarData && "text-muted-foreground")}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {pagarData ? format(pagarData, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pagarData}
                      onSelect={setPagarData}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button className="w-full" onClick={() => avancarParcela(pagarConta, pagarData)}>
                💰 Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conta?</AlertDialogTitle>
            <AlertDialogDescription>A conta será desativada e não aparecerá mais na lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
