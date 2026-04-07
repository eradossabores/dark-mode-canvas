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
import { DollarSign, Plus, Pencil, Trash2, Loader2, TrendingDown, Receipt, CircleDollarSign, AlertTriangle, Check, X, CalendarDays, BarChart3, Search, Filter, FileDown, Bell, TrendingUp, History } from "lucide-react";
import { format, startOfMonth, differenceInDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import jsPDF from "jspdf";
import logoUrl from "@/assets/logo.png";

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "especie", label: "Espécie" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "cheque", label: "Cheque" },
];

const CATEGORIAS = [
  { value: "aluguel", label: "🏠 Aluguel", icon: "🏠" },
  { value: "veiculo", label: "🚗 Veículo", icon: "🚗" },
  { value: "equipamento", label: "⚙️ Equipamento", icon: "⚙️" },
  { value: "energia", label: "⚡ Energia", icon: "⚡" },
  { value: "agua", label: "💧 Água", icon: "💧" },
  { value: "internet", label: "🌐 Internet/Tel", icon: "🌐" },
  { value: "salario", label: "👤 Salário", icon: "👤" },
  { value: "manutencao", label: "🔧 Manutenção", icon: "🔧" },
  { value: "materia_prima", label: "📦 Matéria-prima", icon: "📦" },
  { value: "outros", label: "📋 Outros", icon: "📋" },
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
  categoria: string;
}

interface PagamentoConta {
  id: string;
  conta_id: string;
  valor: number;
  forma_pagamento: string;
  data_pagamento: string;
  parcela_numero: number | null;
  observacoes: string | null;
}

export default function ContasAPagar() {
  const { factoryId, role, factoryName, branding } = useAuth();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null);
  const [pagarData, setPagarData] = useState<Date | undefined>(undefined);
  const [pagarForma, setPagarForma] = useState<string>("pix");
  const [pagarValor, setPagarValor] = useState("");
  const [pagarFixoConta, setPagarFixoConta] = useState<ContaPagar | null>(null);
  const [pagarFixoValor, setPagarFixoValor] = useState("");
  const [pagarFixoForma, setPagarFixoForma] = useState<string>("pix");
  const [historicoContaId, setHistoricoContaId] = useState<string | null>(null);

  // Filters
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Form state
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [tipo, setTipo] = useState<"fixo" | "parcelado">("parcelado");
  const [categoria, setCategoria] = useState("outros");
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
  const [editCategoria, setEditCategoria] = useState("outros");

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

  // Filtered contas
  const contasFiltradas = useMemo(() => {
    return contas.filter(c => {
      if (busca.trim() && !c.descricao.toLowerCase().includes(busca.toLowerCase()) && !(c.responsavel || "").toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (filtroCategoria !== "todos" && c.categoria !== filtroCategoria) return false;
      if (filtroStatus === "pago" && !c.pago_mes) return false;
      if (filtroStatus === "pendente" && c.pago_mes) return false;
      return true;
    });
  }, [contas, busca, filtroTipo, filtroCategoria, filtroStatus]);

  // Alertas de vencimento (próximos 3 dias)
  const alertasVencimento = useMemo(() => {
    const hoje = new Date();
    return contas.filter(c => {
      if (c.pago_mes) return false;
      if (c.proxima_parcela_data) {
        const venc = new Date(c.proxima_parcela_data + "T12:00:00");
        const dias = differenceInDays(venc, hoje);
        return dias >= 0 && dias <= 3;
      }
      return false;
    });
  }, [contas]);

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
      
      const fixoTotal = contas.filter(c => c.tipo === "fixo").reduce((s, c) => s + c.valor_parcela, 0);
      
      const parceladoTotal = contas.filter(c => {
        if (c.tipo !== "parcelado") return false;
        const created = new Date(c.created_at || "");
        const createdMonth = startOfMonth(created);
        const thisMonth = startOfMonth(monthDate);
        if (createdMonth > thisMonth) return false;
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

  // Previsão de gastos (próximos 3 meses)
  const previsao = useMemo(() => {
    const now = new Date();
    const meses: { label: string; valor: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const futureDate = addMonths(now, i);
      const fixoTotal = contas.filter(c => c.tipo === "fixo").reduce((s, c) => s + c.valor_parcela, 0);
      const parceladoTotal = contas.filter(c => {
        if (c.tipo !== "parcelado") return false;
        const created = new Date(c.created_at || "");
        const createdMonth = startOfMonth(created);
        const thisMonth = startOfMonth(futureDate);
        if (createdMonth > thisMonth) return false;
        const monthsElapsed = (thisMonth.getFullYear() - createdMonth.getFullYear()) * 12 + (thisMonth.getMonth() - createdMonth.getMonth());
        return monthsElapsed < (c.total_parcelas || 1);
      }).reduce((s, c) => s + c.valor_parcela, 0);
      meses.push({ label: format(futureDate, "MMM/yy", { locale: ptBR }), valor: fixoTotal + parceladoTotal });
    }
    return meses;
  }, [contas]);

  // Gastos por categoria
  const gastosPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    contas.forEach(c => {
      const cat = c.categoria || "outros";
      map[cat] = (map[cat] || 0) + c.valor_parcela;
    });
    return Object.entries(map).map(([cat, valor]) => ({
      name: CATEGORIAS.find(cc => cc.value === cat)?.label || cat,
      valor,
    })).sort((a, b) => b.valor - a.valor);
  }, [contas]);

  async function loadContas() {
    setLoading(true);
    let q = (supabase as any)
      .from("contas_a_pagar").select("*").eq("ativa", true).order("created_at");
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data, error } = await q;
    if (error) { console.error(error); }
    setContas(data || []);

    // Load payment history
    let pq = (supabase as any).from("pagamentos_contas").select("*").order("data_pagamento", { ascending: false });
    if (factoryId) pq = pq.eq("factory_id", factoryId);
    const { data: pData } = await pq;
    setPagamentos(pData || []);

    setLoading(false);
  }

  function resetForm() {
    setDescricao(""); setResponsavel(""); setTipo("parcelado"); setValorTotal("");
    setValorEntrada(""); setFormaEntrada("pix"); setPagamentosIntermediarios([]);
    setTotalParcelas(""); setValorParcela(""); setCategoria("outros");
  }

  async function handleAdd() {
    if (!descricao) return toast({ title: "Preencha a descrição", variant: "destructive" });
    if (tipo === "parcelado" && !valorTotal) return toast({ title: "Preencha o valor total", variant: "destructive" });
    if (tipo === "fixo" && !valorParcela) return toast({ title: "Preencha o valor mensal", variant: "destructive" });

    setSaving(true);

    const vp = tipo === "parcelado" ? calcValorParcela : parseFloat(valorParcela || "0");
    const tp = tipo === "parcelado" ? calcTotalParcelas : 0;
    const vt = tipo === "parcelado" ? calcValorTotalNum : 0;
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
      parcela_atual: 0,
      total_parcelas: tp,
      tipo,
      valor_total: vt,
      valor_restante: Math.max(0, Math.round(vr * 100) / 100),
      factory_id: factoryId,
      categoria,
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
    setEditCategoria(c.categoria || "outros");
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
      categoria: editCategoria,
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

  async function registrarPagamento(contaId: string, valor: number, forma: string, parcelaNum?: number, obs?: string) {
    await (supabase as any).from("pagamentos_contas").insert({
      conta_id: contaId,
      factory_id: factoryId,
      valor,
      forma_pagamento: forma,
      parcela_numero: parcelaNum || null,
      observacoes: obs || null,
    });
  }

  async function avancarParcela(c: ContaPagar, proximaData?: Date) {
    if (c.tipo !== "parcelado" || c.parcela_atual >= c.total_parcelas) return;
    const valorPago = parseFloat(pagarValor || String(c.valor_parcela));
    const novaParcela = c.parcela_atual + 1;
    const novoRestante = Math.max(0, c.valor_restante - valorPago);
    const formaLabel = FORMAS_PAGAMENTO.find(f => f.value === pagarForma)?.label || pagarForma;
    await (supabase as any).from("contas_a_pagar").update({
      parcela_atual: novaParcela,
      valor_restante: Math.round(novoRestante * 100) / 100,
      pago_mes: true,
      proxima_parcela_data: proximaData ? format(proximaData, "yyyy-MM-dd") : null,
    }).eq("id", c.id);

    // Register payment history
    await registrarPagamento(c.id, valorPago, pagarForma, novaParcela, `Parcela ${novaParcela}/${c.total_parcelas}`);

    toast({ title: `Parcela ${novaParcela}/${c.total_parcelas} paga! (${formaLabel})` });
    
    const descName = c.descricao.split(" — ")[0];
    await gerarComprovante(descName, valorPago, formaLabel, "parcelado", `${novaParcela}/${c.total_parcelas}`);
    
    setPagarConta(null);
    setPagarData(undefined);
    setPagarValor("");
    loadContas();
  }

  async function togglePagoMes(c: ContaPagar) {
    const novo = !c.pago_mes;
    await (supabase as any).from("contas_a_pagar").update({ pago_mes: novo }).eq("id", c.id);
    toast({ title: novo ? `✅ ${c.descricao.split(" — ")[0]} — marcada como paga` : `${c.descricao.split(" — ")[0]} — desmarcada` });
    loadContas();
  }

  function loadImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function gerarComprovante(descricao: string, valor: number, formaLabel: string, tipo: "fixo" | "parcelado", parcelaInfo?: string) {
    const doc = new jsPDF({ unit: "mm", format: [80, 160] });
    const W = 80;
    const displayName = factoryName || "ICETECH";
    const useLogo = branding?.logoUrl || logoUrl;

    let y = 8;
    try {
      const base64 = await loadImageAsBase64(useLogo);
      doc.addImage(base64, "PNG", (W - 18) / 2, y, 18, 18);
      y += 22;
    } catch { y += 4; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(displayName, W / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("COMPROVANTE DE PAGAMENTO", W / 2, y, { align: "center" });
    y += 5;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(6, y, W - 6, y);
    y += 5;
    doc.setFontSize(8);

    const addLine = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 8, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, W - 8, y, { align: "right" });
      y += 5;
    };

    addLine("Descrição:", descricao.length > 25 ? descricao.substring(0, 25) + "..." : descricao);
    addLine("Tipo:", tipo === "fixo" ? "Custo Fixo" : "Parcelado");
    if (parcelaInfo) addLine("Parcela:", parcelaInfo);
    addLine("Valor Pago:", valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    addLine("Pagamento:", formaLabel);
    addLine("Data:", format(new Date(), "dd/MM/yyyy HH:mm"));

    y += 2;
    doc.line(6, y, W - 6, y);
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`${displayName} — Sistema de Gestão`, W / 2, y, { align: "center" });
    doc.save(`comprovante_${descricao.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20)}.pdf`);
  }

  async function handlePagarFixoAdiantamento() {
    if (!pagarFixoConta) return;
    const valor = parseFloat(pagarFixoValor || "0");
    if (valor <= 0) return toast({ title: "Informe um valor válido", variant: "destructive" });
    const formaLabel = FORMAS_PAGAMENTO.find(f => f.value === pagarFixoForma)?.label || pagarFixoForma;
    
    await (supabase as any).from("contas_a_pagar").update({
      pago_mes: true,
      valor_parcela: Math.round(valor * 100) / 100,
    }).eq("id", pagarFixoConta.id);

    // Register payment history
    await registrarPagamento(pagarFixoConta.id, valor, pagarFixoForma, null, "Custo fixo mensal");
    
    const descName = pagarFixoConta.descricao.split(" — ")[0];
    toast({ title: `✅ ${descName} — Pago ${R(valor)} (${formaLabel})` });
    await gerarComprovante(descName, valor, formaLabel, "fixo");
    
    setPagarFixoConta(null);
    setPagarFixoValor("");
    setPagarFixoForma("pix");
    loadContas();
  }

  function handleExportPDF() {
    const headers = ["Descrição", "Categoria", "Tipo", "Valor/Mês", "Status", "Restante"];
    const rows = contasFiltradas.map(c => [
      c.descricao.split(" — ")[0],
      CATEGORIAS.find(cc => cc.value === c.categoria)?.label?.replace(/^. /, "") || c.categoria,
      c.tipo === "fixo" ? "Fixo" : "Parcelado",
      R(c.valor_parcela),
      c.pago_mes ? "Pago" : "Pendente",
      c.tipo === "parcelado" ? R(c.valor_restante) : "—",
    ]);
    exportToPDF("Contas a Pagar", headers, rows, "contas-a-pagar-export", [
      { label: "Total Mensal", value: R(totalMensal) },
      { label: "Saldo Devedor", value: R(totalRestante) },
      { label: "Custos Fixos", value: R(totalFixo) },
      { label: "Parcelas/Mês", value: R(totalParcelado) },
    ], undefined, { factoryName: factoryName || undefined, factoryLogoUrl: branding?.logoUrl });
  }

  function handleExportExcel() {
    const headers = ["Descrição", "Categoria", "Tipo", "Responsável", "Valor/Mês", "Status Mês", "Total", "Restante", "Parcela"];
    const rows = contasFiltradas.map(c => [
      c.descricao.split(" — ")[0],
      CATEGORIAS.find(cc => cc.value === c.categoria)?.label?.replace(/^. /, "") || c.categoria,
      c.tipo === "fixo" ? "Fixo" : "Parcelado",
      c.responsavel || "—",
      `R$ ${c.valor_parcela.toFixed(2)}`,
      c.pago_mes ? "Pago" : "Pendente",
      c.tipo === "parcelado" ? `R$ ${c.valor_total.toFixed(2)}` : "—",
      c.tipo === "parcelado" ? `R$ ${c.valor_restante.toFixed(2)}` : "—",
      c.tipo === "parcelado" ? `${c.parcela_atual}/${c.total_parcelas}` : "—",
    ]);
    exportToExcel(headers, rows, "Contas a Pagar", "contas-a-pagar");
  }

  const R = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fixas = contasFiltradas.filter(c => c.tipo === "fixo");
  const parceladas = contasFiltradas.filter(c => c.tipo === "parcelado");
  const totalMensal = contasFiltradas.reduce((s, c) => s + c.valor_parcela, 0);
  const totalRestante = parceladas.reduce((s, c) => s + c.valor_restante, 0);
  const totalFixo = fixas.reduce((s, c) => s + c.valor_parcela, 0);
  const totalParcelado = parceladas.reduce((s, c) => s + c.valor_parcela, 0);
  const contasPagas = contasFiltradas.filter(c => c.pago_mes).length;
  const contasPendentes = contasFiltradas.filter(c => !c.pago_mes).length;

  // Historico for selected conta
  const historicoConta = useMemo(() => {
    if (!historicoContaId) return [];
    return pagamentos.filter(p => p.conta_id === historicoContaId);
  }, [historicoContaId, pagamentos]);

  const historicoContaNome = contas.find(c => c.id === historicoContaId)?.descricao.split(" — ")[0] || "";

  function getCategoriaIcon(cat: string) {
    return CATEGORIAS.find(c => c.value === cat)?.icon || "📋";
  }

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
            <Label>Categoria</Label>
            <Select value={editCategoria} onValueChange={setEditCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">{contas.length} conta(s) ativa(s) · {contasPendentes} pendente(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4" /> Excel
          </Button>
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
      </div>

      {/* Alertas de Vencimento */}
      {alertasVencimento.length > 0 && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-foreground">⚠️ Alertas de Vencimento</span>
            </div>
            <div className="space-y-1">
              {alertasVencimento.map(c => {
                const dias = differenceInDays(new Date(c.proxima_parcela_data + "T12:00:00"), new Date());
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span>{getCategoriaIcon(c.categoria)} {c.descricao.split(" — ")[0]}</span>
                    <Badge variant={dias === 0 ? "destructive" : "secondary"} className="text-xs">
                      {dias === 0 ? "Vence HOJE!" : `Vence em ${dias} dia(s)`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card rounded-lg border">
        <div>
          <Label className="text-xs mb-1 block">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Descrição ou responsável..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 w-[180px]" />
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="fixo">Fixo</SelectItem>
              <SelectItem value="parcelado">Parcelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Categoria</Label>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5 text-primary" /> Total Mensal
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalMensal)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{contasFiltradas.length} conta(s)</p>
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
            <p className="text-xl font-bold text-foreground">{contasPagas}/{contasFiltradas.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{contasPendentes > 0 ? `${contasPendentes} pendente(s)` : "Tudo pago! ✅"}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Previsão 3m
            </div>
            <p className="text-lg font-bold text-foreground">
              {previsao.length > 0 ? R(previsao.reduce((s, p) => s + p.valor, 0) / previsao.length) : R(0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Média mensal prevista</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Gastos Mensais ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis 
                    tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} 
                    tick={{ fontSize: 11 }} 
                    className="text-muted-foreground"
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isCurrent ? "hsl(var(--primary))" : entry.isFuture ? "hsl(var(--primary) / 0.25)" : "hsl(var(--primary) / 0.5)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/50" /> Anteriores</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /> Atual</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/25" /> Previsão</div>
            </div>
          </CardContent>
        </Card>

        {/* Gastos por categoria */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Gastos por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gastosPorCategoria.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma conta cadastrada</p>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gastosPorCategoria} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tickFormatter={v => `R$${v}`} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => R(v)} />
                    <Bar dataKey="valor" name="Valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Previsão de Gastos */}
      {previsao.length > 0 && (
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Previsão de Gastos (Próximos 3 Meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {previsao.map((p, i) => (
                <div key={i} className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground uppercase font-medium">{p.label}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{R(p.valor)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    <TableHead>Cat.</TableHead>
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
                        <TableCell>
                          <span title={CATEGORIAS.find(cc => cc.value === c.categoria)?.label || c.categoria}>
                            {getCategoriaIcon(c.categoria)}
                          </span>
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
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHistoricoContaId(c.id)} title="Histórico">
                              <History className="h-3.5 w-3.5" />
                            </Button>
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
                    <TableCell colSpan={4}>TOTAL PARCELADAS</TableCell>
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
                  <TableHead>Cat.</TableHead>
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
                    <TableCell>
                      <span title={CATEGORIAS.find(cc => cc.value === c.categoria)?.label || c.categoria}>
                        {getCategoriaIcon(c.categoria)}
                      </span>
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
                        title={c.pago_mes ? "Pago este mês ✅" : "Pendente este mês"}
                      >
                        {c.pago_mes ? <Check className="h-4 w-4 text-white" /> : <X className="h-4 w-4 text-destructive" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{R(c.valor_parcela)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHistoricoContaId(c.id)} title="Histórico">
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setPagarFixoConta(c); setPagarFixoValor(String(c.valor_parcela)); }} title="Pagar / Adiantar">
                          💰 Pagar
                        </Button>
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
                  <TableCell colSpan={4}>TOTAL FIXOS</TableCell>
                  <TableCell className="text-right font-mono">{R(totalFixo)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {contasFiltradas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">
              {contas.length === 0 ? "Nenhuma conta cadastrada" : "Nenhuma conta encontrada com os filtros aplicados"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {contas.length === 0 ? 'Clique em "Nova Conta" para adicionar.' : "Tente alterar os filtros."}
            </p>
            {contas.length === 0 && (
              <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
            )}
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
          <DialogHeader><DialogTitle>Pagar Parcela</DialogTitle></DialogHeader>
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
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Data da próxima parcela (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !pagarData && "text-muted-foreground")}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {pagarData ? format(pagarData, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={pagarData} onSelect={setPagarData} initialFocus className={cn("p-3 pointer-events-auto")} />
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

      {/* Pagar Fixo Dialog */}
      <Dialog open={!!pagarFixoConta} onOpenChange={v => { if (!v) { setPagarFixoConta(null); setPagarFixoValor(""); setPagarFixoForma("pix"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pagar Custo Fixo</DialogTitle></DialogHeader>
          {pagarFixoConta && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-bold">{pagarFixoConta.descricao.split(" — ")[0]}</p>
                <p className="text-xs text-muted-foreground">
                  Valor base cadastrado: <strong>{R(pagarFixoConta.valor_parcela)}</strong>
                </p>
                <Badge variant={pagarFixoConta.pago_mes ? "default" : "destructive"} className="text-xs mt-1">
                  {pagarFixoConta.pago_mes ? "✅ Pago este mês" : "⏳ Pendente este mês"}
                </Badge>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Valor real deste mês *</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input type="number" step="0.01" className="pl-7" value={pagarFixoValor} onChange={e => setPagarFixoValor(e.target.value)} placeholder="Ex: 185,50" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  💡 Para despesas com valor variável (ex: energia, água), informe o valor real da conta deste mês.
                </p>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Forma de pagamento</Label>
                <Select value={pagarFixoForma} onValueChange={setPagarFixoForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handlePagarFixoAdiantamento}>
                ✅ Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Histórico de Pagamentos Dialog */}
      <Dialog open={!!historicoContaId} onOpenChange={v => { if (!v) setHistoricoContaId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico — {historicoContaNome}
            </DialogTitle>
          </DialogHeader>
          {historicoConta.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">Nenhum pagamento registrado ainda.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {historicoConta.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{R(p.valor)}</p>
                    <p className="text-xs text-muted-foreground">
                      {FORMAS_PAGAMENTO.find(f => f.value === p.forma_pagamento)?.label || p.forma_pagamento}
                      {p.parcela_numero && ` · Parcela ${p.parcela_numero}`}
                    </p>
                    {p.observacoes && <p className="text-[10px] text-muted-foreground">{p.observacoes}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {new Date(p.data_pagamento).toLocaleDateString("pt-BR")}
                  </Badge>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold">
                <span>Total pago:</span>
                <span className="text-primary">{R(historicoConta.reduce((s, p) => s + Number(p.valor), 0))}</span>
              </div>
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
