import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, AlertTriangle, MinusCircle, History, Search, MessageCircle, Printer, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoRecibo from "@/assets/logo-recibo.png";
import { useAuth } from "@/contexts/AuthContext";

export default function AReceber() {
  const { factoryId, role, branding, factoryName } = useAuth();
  const [factoryLogo, setFactoryLogo] = useState<string>(logoRecibo);

  useEffect(() => {
    if (branding?.logoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setFactoryLogo(canvas.toDataURL("image/png"));
        }
      };
      img.onerror = () => setFactoryLogo(logoRecibo);
      img.src = branding.logoUrl;
    } else {
      setFactoryLogo(logoRecibo);
    }
  }, [branding?.logoUrl]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaterVenda, setAbaterVenda] = useState<any>(null);
  const [valorAbater, setValorAbater] = useState("");
  const [historicoVenda, setHistoricoVenda] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [whatsappPrompt, setWhatsappPrompt] = useState<{ vendaId: string; clienteNome: string; total: number; telefone: string; valorPago: number; historico: { valor: number; data: string }[]; quitou: boolean } | null>(null);
  const [abatimentoLoteCliente, setAbatimentoLoteCliente] = useState("");
  const [abatimentoLoteValor, setAbatimentoLoteValor] = useState("");
  const [processandoLote, setProcessandoLote] = useState(false);
  const [confirmarQuitarId, setConfirmarQuitarId] = useState<string | null>(null);
  const [mesFiltro, setMesFiltro] = useState<string>("todos");

  // Payment method states
  const [formaPgtoAbater, setFormaPgtoAbater] = useState<"pix" | "especie" | "misto">("especie");
  const [valorPixAbater, setValorPixAbater] = useState("");
  const [valorEspecieAbater, setValorEspecieAbater] = useState("");

  const [formaPgtoQuitar, setFormaPgtoQuitar] = useState<"pix" | "especie" | "misto">("especie");
  const [valorPixQuitar, setValorPixQuitar] = useState("");
  const [valorEspecieQuitar, setValorEspecieQuitar] = useState("");

  const [formaPgtoLote, setFormaPgtoLote] = useState<"pix" | "especie" | "misto">("especie");
  const [valorPixLote, setValorPixLote] = useState("");
  const [valorEspecieLote, setValorEspecieLote] = useState("");

  useEffect(() => {
    if (role !== "super_admin" && !factoryId) { setVendas([]); setLoading(false); return; }
    loadData();
  }, [factoryId, role]);

  async function loadData() {
    setLoading(true);
    let q = (supabase as any)
      .from("vendas")
      .select("*, clientes(nome, telefone)")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    setVendas(data || []);
    setLoading(false);
  }

  async function loadHistorico(vendaId: string) {
    const { data } = await (supabase as any)
      .from("abatimentos_historico")
      .select("*")
      .eq("venda_id", vendaId)
      .order("created_at", { ascending: true });
    setHistorico(data || []);
  }

  async function checkWhatsappPrompt(vendaId: string, clienteId: string, clienteNome: string, total: number, valorPago: number, quitou: boolean) {
    const { data: cliente } = await (supabase as any).from("clientes").select("telefone").eq("id", clienteId).single();
    if (cliente?.telefone) {
      const { data: hist } = await (supabase as any)
        .from("abatimentos_historico")
        .select("valor, created_at")
        .eq("venda_id", vendaId)
        .order("created_at", { ascending: true });
      const historicoFormatado = (hist || []).map((h: any) => ({
        valor: Number(h.valor),
        data: new Date(h.created_at).toLocaleDateString("pt-BR"),
      }));
      setWhatsappPrompt({ vendaId, clienteNome, total, telefone: cliente.telefone, valorPago, historico: historicoFormatado, quitou });
    }
  }

  function gerarPdfRecibo(): jsPDF | null {
    if (!whatsappPrompt) return null;
    const p = whatsappPrompt;
    const restante = p.total - p.valorPago;
    const doc = new jsPDF({ unit: "mm", format: [80, 220] });
    const w = 80;
    let y = 4;

    try {
      doc.addImage(factoryLogo, "PNG", (w - 40) / 2, y, 40, 32);
      y += 34;
    } catch { y += 4; }

    doc.setFontSize(7);
    doc.text(factoryName || "ICETECH", w / 2, y, { align: "center" });
    y += 5;

    doc.setLineWidth(0.3);
    doc.line(4, y, w - 4, y);
    y += 4;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(p.quitou ? "RECIBO - PAGAMENTO COMPLETO" : "RECIBO - PAGAMENTO PARCIAL", w / 2, y, { align: "center" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Cliente: ${p.clienteNome}`, 4, y); y += 4;
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 4, y); y += 4;
    doc.text(`Valor Total da Venda: R$ ${p.total.toFixed(2)}`, 4, y); y += 4;
    if (p.valorPago > 0) {
      doc.text(`Total Pago: R$ ${p.valorPago.toFixed(2)}`, 4, y); y += 4;
    }
    if (!p.quitou) {
      doc.text(`Restante: R$ ${restante.toFixed(2)}`, 4, y); y += 4;
    }

    doc.line(4, y, w - 4, y);
    y += 3;

    if (p.historico.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("HISTORICO DE PAGAMENTOS", w / 2, y, { align: "center" });
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: 4, right: 4 },
        head: [["#", "Data", "Valor"]],
        body: p.historico.map((h, i) => [
          String(i + 1),
          h.data,
          `R$ ${h.valor.toFixed(2)}`,
        ]),
        styles: { fontSize: 6.5, cellPadding: 1.5 },
        headStyles: { fillColor: [0, 136, 204], fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 28 },
          2: { cellWidth: 28, halign: "right" },
        },
        theme: "grid",
      });

      y = (doc as any).lastAutoTable.finalY + 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`Total Pago: R$ ${p.valorPago.toFixed(2)}`, w - 4, y, { align: "right" });
      y += 5;
    }

    doc.line(4, y, w - 4, y);
    y += 5;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const statusText = p.quitou ? "QUITADO" : `RESTANTE: R$ ${restante.toFixed(2)}`;
    doc.text(statusText, w / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text("Obrigado pela preferencia!", w / 2, y, { align: "center" });

    if (p.quitou) {
      const centerX = w / 2;
      const centerY = 100;
      doc.setDrawColor(34, 139, 34);
      doc.setFillColor(34, 139, 34);
      doc.setLineWidth(1.8);
      doc.roundedRect(centerX - 28, centerY - 10, 56, 20, 4, 4, "S");
      doc.setLineWidth(0.8);
      doc.roundedRect(centerX - 26, centerY - 8, 52, 16, 3, 3, "S");
      doc.setTextColor(34, 139, 34);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("PAGO", centerX, centerY + 4, { align: "center" });
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    }

    return doc;
  }

  async function enviarReciboWhatsApp() {
    if (!whatsappPrompt) return;
    const p = whatsappPrompt;

    const doc = gerarPdfRecibo();
    const restante = p.total - p.valorPago;
    const statusLine = p.quitou ? "Pagamento Completo!" : (p.valorPago > 0 ? `Pagamento Parcial (Restante: R$ ${restante.toFixed(2)})` : `Valor Pendente: R$ ${restante.toFixed(2)}`);
    const pagoLine = p.valorPago > 0 ? `\nPago: R$ ${p.valorPago.toFixed(2)}` : "";
    const displayName = factoryName || "ICETECH";
    const msg = `*${displayName}*\n\n${statusLine}\n\nCliente: ${p.clienteNome}\nValor: R$ ${p.total.toFixed(2)}${pagoLine}`;

    if (doc) {
      const pdfBlob = doc.output("blob");
      const fileName = `recibo-${p.clienteNome.replace(/\s+/g, "-")}.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ text: msg, files: [file] });
          setWhatsappPrompt(null);
          return;
        } catch (e) {
          console.log("Share cancelled, falling back");
        }
      }

      doc.save(fileName);
    }

    const phone = p.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg + "\n\n_Recibo PDF baixado no seu dispositivo._")}`, "_blank");
    setWhatsappPrompt(null);
  }

  async function marcarComoPaga(id: string) {
    try {
      const venda = vendas.find(v => v.id === id);
      const restante = (venda?.total || 0) - (venda?.valor_pago || 0);

      const { error } = await (supabase as any)
        .from("vendas")
        .update({ status: "paga", valor_pago: venda?.total || 0 })
        .eq("id", id);
      if (error) throw error;

      if (restante > 0) {
        const quitarVPix = formaPgtoQuitar === "pix" ? restante : formaPgtoQuitar === "misto" ? parseFloat(valorPixQuitar.replace(",", ".")) || 0 : 0;
        const quitarVEsp = formaPgtoQuitar === "especie" ? restante : formaPgtoQuitar === "misto" ? parseFloat(valorEspecieQuitar.replace(",", ".")) || 0 : 0;
        await (supabase as any).from("abatimentos_historico").insert({
          venda_id: id,
          valor: restante,
          forma_pagamento: formaPgtoQuitar,
          valor_pix: quitarVPix,
          valor_especie: quitarVEsp,
        });
      }

      toast({ title: "Venda marcada como paga!" });
      await checkWhatsappPrompt(id, venda.cliente_id, venda.clientes?.nome || "?", Number(venda.total), Number(venda.total), true);
      setConfirmarQuitarId(null);
      setFormaPgtoQuitar("especie");
      setValorPixQuitar("");
      setValorEspecieQuitar("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function abaterValor() {
    if (!abaterVenda) return;
    let valor = 0;
    let vPix = 0;
    let vEsp = 0;

    if (formaPgtoAbater === "misto") {
      vPix = parseFloat(valorPixAbater.replace(",", ".")) || 0;
      vEsp = parseFloat(valorEspecieAbater.replace(",", ".")) || 0;
      valor = vPix + vEsp;
    } else {
      valor = parseFloat(valorAbater.replace(",", "."));
      vPix = formaPgtoAbater === "pix" ? valor : 0;
      vEsp = formaPgtoAbater === "especie" ? valor : 0;
    }

    if (isNaN(valor) || valor <= 0) {
      return toast({ title: "Informe um valor valido", variant: "destructive" });
    }

    const totalVenda = Number(abaterVenda.total);
    const jasPago = Number(abaterVenda.valor_pago || 0);
    const restante = totalVenda - jasPago;

    if (valor > restante) {
      return toast({ title: "Valor maior que o restante", description: `Restante: R$ ${restante.toFixed(2)}`, variant: "destructive" });
    }

    const novoValorPago = jasPago + valor;
    const quitou = novoValorPago >= totalVenda;

    try {
      const { error } = await (supabase as any)
        .from("vendas")
        .update({
          valor_pago: novoValorPago,
          status: quitou ? "paga" : "pendente",
        })
        .eq("id", abaterVenda.id);
      if (error) throw error;

      await (supabase as any).from("abatimentos_historico").insert({
        venda_id: abaterVenda.id,
        valor,
        forma_pagamento: formaPgtoAbater,
        valor_pix: vPix,
        valor_especie: vEsp,
      });

      toast({
        title: quitou ? "Venda quitada!" : "Valor abatido!",
        description: quitou
          ? `R$ ${valor.toFixed(2)} recebido. Venda totalmente paga.`
          : `R$ ${valor.toFixed(2)} recebido. Restante: R$ ${(restante - valor).toFixed(2)}`,
      });

      await checkWhatsappPrompt(abaterVenda.id, abaterVenda.cliente_id, abaterVenda.clientes?.nome || "?", totalVenda, novoValorPago, quitou);

      setAbaterVenda(null);
      setValorAbater("");
      setFormaPgtoAbater("especie");
      setValorPixAbater("");
      setValorEspecieAbater("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  // Abatimento em lote
  const clientesUnicos = [...new Map(vendas.map(v => [v.cliente_id, v.clientes?.nome || "?"])).entries()];
  const vendasDoClienteLote = abatimentoLoteCliente
    ? vendas.filter(v => v.cliente_id === abatimentoLoteCliente).sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];
  const totalDevidoClienteLote = vendasDoClienteLote.reduce((s, v) => s + (Number(v.total) - Number(v.valor_pago || 0)), 0);

  async function abaterEmLote() {
    if (!abatimentoLoteCliente) return toast({ title: "Selecione um cliente", variant: "destructive" });
    let valorTotal = 0;
    let loteVPix = 0;
    let loteVEsp = 0;

    if (formaPgtoLote === "misto") {
      loteVPix = parseFloat(valorPixLote.replace(",", ".")) || 0;
      loteVEsp = parseFloat(valorEspecieLote.replace(",", ".")) || 0;
      valorTotal = loteVPix + loteVEsp;
    } else {
      valorTotal = parseFloat(abatimentoLoteValor.replace(",", "."));
      loteVPix = formaPgtoLote === "pix" ? valorTotal : 0;
      loteVEsp = formaPgtoLote === "especie" ? valorTotal : 0;
    }

    if (isNaN(valorTotal) || valorTotal <= 0) return toast({ title: "Informe um valor valido", variant: "destructive" });
    if (valorTotal > totalDevidoClienteLote) return toast({ title: "Valor maior que o total devido", description: `Total devido: R$ ${totalDevidoClienteLote.toFixed(2)}`, variant: "destructive" });

    let valor = valorTotal;
    setProcessandoLote(true);
    try {
      for (const v of vendasDoClienteLote) {
        if (valor <= 0) break;
        const restante = Number(v.total) - Number(v.valor_pago || 0);
        if (restante <= 0) continue;
        const abater = Math.min(valor, restante);
        const novoValorPago = Number(v.valor_pago || 0) + abater;
        const quitou = novoValorPago >= Number(v.total);

        const { error } = await (supabase as any)
          .from("vendas")
          .update({ valor_pago: novoValorPago, status: quitou ? "paga" : "pendente" })
          .eq("id", v.id);
        if (error) throw error;

        // Proportional split for mixed payments
        const ratio = abater / valorTotal;
        await (supabase as any).from("abatimentos_historico").insert({
          venda_id: v.id,
          valor: abater,
          forma_pagamento: formaPgtoLote,
          valor_pix: Math.round(loteVPix * ratio * 100) / 100,
          valor_especie: Math.round(loteVEsp * ratio * 100) / 100,
        });
        valor -= abater;
      }

      toast({ title: "Abatimento em lote realizado!", description: "Valor distribuido entre as contas do cliente." });
      setAbatimentoLoteCliente("");
      setAbatimentoLoteValor("");
      setFormaPgtoLote("especie");
      setValorPixLote("");
      setValorEspecieLote("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setProcessandoLote(false);
    }
  }

  async function gerarReciboVenda(v: any) {
    // Fetch latest venda data from DB
    const { data: vendaAtual } = await (supabase as any)
      .from("vendas")
      .select("*, clientes(nome)")
      .eq("id", v.id)
      .single();
    const venda = vendaAtual || v;
    const total = Number(venda.total);
    const pago = Number(venda.valor_pago || 0);
    const restante = total - pago;
    const isPago = venda.status === "paga" || restante <= 0;

    const { data: itens } = await (supabase as any)
      .from("venda_itens")
      .select("*, sabores(nome)")
      .eq("venda_id", v.id);

    const { data: abatimentos } = await (supabase as any)
      .from("abatimentos_historico")
      .select("*")
      .eq("venda_id", v.id)
      .order("created_at", { ascending: true });

    const drawDottedLine = (doc: jsPDF, x1: number, yy: number, x2: number) => {
      for (let x = x1; x < x2; x += 1.5) doc.line(x, yy, x + 0.5, yy);
    };

    const doc = new jsPDF({ unit: "mm", format: [80, 300] });
    const w = 80;
    let y = 4;

    // Top band
    doc.setFillColor(0, 100, 160);
    doc.rect(0, 0, w, 3, "F");
    y = 6;

    try {
      doc.addImage(factoryLogo, "PNG", (w - 36) / 2, y, 36, 28);
      y += 30;
    } catch { y += 4; }

    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "italic");
    doc.text(factoryName || "ICETECH", w / 2, y, { align: "center" });
    y += 4;

    // Decorative double line
    doc.setDrawColor(0, 100, 160);
    doc.setLineWidth(0.6);
    doc.line(6, y, w - 6, y);
    doc.setLineWidth(0.2);
    doc.line(6, y + 1.2, w - 6, y + 1.2);
    y += 4;

    // Title badge
    doc.setFillColor(0, 100, 160);
    doc.roundedRect(10, y - 1, w - 20, 7, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE VENDA", w / 2, y + 4, { align: "center" });
    y += 10;

    // Client info
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7);
    const infoLabel = (label: string, value: string, yPos: number) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(label, 6, yPos);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(value, 28, yPos);
    };

    infoLabel("Cliente:", venda.clientes?.nome || "-", y); y += 3.5;
    infoLabel("Data:", new Date(venda.created_at).toLocaleDateString("pt-BR"), y); y += 3.5;
    infoLabel("Pgto:", venda.forma_pagamento?.replace("_", " ") || "-", y); y += 3.5;
    if (venda.numero_nf) { infoLabel("NF:", venda.numero_nf, y); y += 3.5; }
    y += 2;

    doc.setDrawColor(200, 200, 200);
    drawDottedLine(doc, 6, y, w - 6);
    y += 3;

    // Items table
    if (itens && itens.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: 4, right: 4 },
        head: [["Sabor", "Qtd", "Unit.", "Subtotal"]],
        body: itens.map((i: any) => [
          i.sabores?.nome || "-",
          String(i.quantidade),
          `R$${Number(i.preco_unitario).toFixed(2)}`,
          `R$${Number(i.subtotal).toFixed(2)}`,
        ]),
        styles: { fontSize: 6.5, cellPadding: 1.8, textColor: [40, 40, 40] },
        headStyles: { fillColor: [0, 100, 160], fontSize: 6.5, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 246, 252] },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 8, halign: "center" },
          2: { cellWidth: 16, halign: "right" },
          3: { cellWidth: 18, halign: "right" },
        },
        theme: "grid",
        tableLineColor: [200, 210, 220],
        tableLineWidth: 0.2,
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Quantity badge
    const totalQtd = (itens || []).reduce((s: number, i: any) => s + Number(i.quantidade), 0);
    doc.setFillColor(240, 246, 252);
    doc.roundedRect(6, y - 1, w - 12, 6, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 100, 160);
    doc.text(`Qtd Total: ${totalQtd} unidades`, w / 2, y + 3, { align: "center" });
    y += 9;

    // TOTAL highlight box
    doc.setFillColor(0, 100, 160);
    doc.roundedRect(6, y - 1, w - 12, 9, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: R$ ${total.toFixed(2)}`, w / 2, y + 5.5, { align: "center" });
    y += 13;

    // Payment info
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 139, 34);
    doc.text(`Pago: R$ ${pago.toFixed(2)}`, 6, y); y += 4;
    if (!isPago && restante > 0) {
      doc.setTextColor(200, 120, 0);
      doc.text(`Restante: R$ ${restante.toFixed(2)}`, 6, y); y += 4;
    }
    y += 2;

    // Historico de abatimentos
    if (abatimentos && abatimentos.length > 0) {
      doc.setDrawColor(200, 200, 200);
      drawDottedLine(doc, 6, y, w - 6);
      y += 3;

      doc.setFillColor(240, 246, 252);
      doc.roundedRect(6, y - 1, w - 12, 6, 1.5, 1.5, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 160);
      doc.text("HISTORICO DE PAGAMENTOS", w / 2, y + 3, { align: "center" });
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: 4, right: 4 },
        head: [["#", "Data / Hora", "Valor"]],
        body: abatimentos.map((h: any, i: number) => [
          String(i + 1),
          new Date(h.created_at).toLocaleDateString("pt-BR") + " " + new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          `R$ ${Number(h.valor).toFixed(2)}`,
        ]),
        styles: { fontSize: 6.5, cellPadding: 1.8, textColor: [40, 40, 40] },
        headStyles: { fillColor: [0, 100, 160], fontSize: 6.5, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 246, 252] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 30 },
          2: { cellWidth: 26, halign: "right" },
        },
        theme: "grid",
        tableLineColor: [200, 210, 220],
        tableLineWidth: 0.2,
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Observations
    if (venda.observacoes) {
      const obs = venda.observacoes.replace(/\s*\[fiado\]\s*/gi, "").trim();
      if (obs) {
        doc.setDrawColor(200, 200, 200);
        drawDottedLine(doc, 6, y, w - 6);
        y += 3;
        doc.setFontSize(6);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120, 120, 120);
        doc.text(`Obs: ${obs}`, 6, y, { maxWidth: w - 12 });
        y += 6;
      }
    }

    // Footer
    doc.setDrawColor(0, 100, 160);
    doc.setLineWidth(0.6);
    doc.line(6, y, w - 6, y);
    doc.setLineWidth(0.2);
    doc.line(6, y + 1.2, w - 6, y + 1.2);
    y += 5;

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Obrigado pela preferencia!", w / 2, y, { align: "center" });
    y += 8;

    // Carimbo PAGO / PENDENTE
    if (isPago) {
      const cx = w / 2;
      const cy = y + 6;
      doc.setDrawColor(34, 160, 34);
      doc.setLineWidth(2.5);
      doc.roundedRect(cx - 26, cy - 9, 52, 18, 5, 5, "S");
      doc.setLineWidth(0.8);
      doc.roundedRect(cx - 24, cy - 7, 48, 14, 4, 4, "S");
      doc.setTextColor(34, 160, 34);
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.text("PAGO", cx, cy + 3, { align: "center" });
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    } else {
      const cx = w / 2;
      const cy = y + 6;
      doc.setDrawColor(200, 120, 0);
      doc.setLineWidth(2);
      doc.roundedRect(cx - 28, cy - 9, 56, 18, 5, 5, "S");
      doc.setLineWidth(0.6);
      doc.roundedRect(cx - 26, cy - 7, 52, 14, 4, 4, "S");
      doc.setTextColor(200, 120, 0);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("PENDENTE", cx, cy + 3, { align: "center" });
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    }

    // Bottom band
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 100, 160);
    doc.rect(0, pageH - 3, w, 3, "F");

    return { doc, venda };
  }

  async function salvarReciboPDF(v: any) {
    const result = await gerarReciboVenda(v);
    if (!result) return;
    result.doc.save(`recibo-${(result.venda.clientes?.nome || "venda").replace(/\s+/g, "-")}.pdf`);
    toast({ title: "Recibo gerado!", description: "PDF salvo no dispositivo." });
  }

  async function enviarReciboWhatsAppDireto(v: any) {
    const result = await gerarReciboVenda(v);
    if (!result) return;
    const { doc, venda } = result;
    const clienteNome = venda.clientes?.nome || "-";
    const total = Number(venda.total);
    const pago = Number(venda.valor_pago || 0);
    const restante = total - pago;
    const fileName = `recibo-${clienteNome.replace(/\s+/g, "-")}.pdf`;

    const pagoLine = pago > 0 ? `\nPago: R$ ${pago.toFixed(2)}` : "";
    const displayName2 = factoryName || "ICETECH";
    const msg = `*${displayName2}*\n\nOlá ${clienteNome}, segue seu recibo.\n\nTotal: R$ ${total.toFixed(2)}${pagoLine}\nRestante: R$ ${restante.toFixed(2)}\nData: ${new Date(venda.created_at).toLocaleDateString("pt-BR")}\nPagamento: ${venda.forma_pagamento?.replace("_", " ") || "-"}`;

    const pdfBlob = doc.output("blob");
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: msg, files: [file] });
        return;
      } catch (e) {
        console.log("Share cancelled, falling back to wa.me");
      }
    }

    doc.save(fileName);
    const phone = v.clientes?.telefone?.replace(/\D/g, "") || "";
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg + "\n\n_Recibo PDF baixado no seu dispositivo._")}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  const hoje = new Date().toISOString().split("T")[0];
  const buscaLower = busca.toLowerCase().trim();
  const vendasPorBusca = buscaLower
    ? vendas.filter(v =>
        v.clientes?.nome?.toLowerCase().includes(buscaLower) ||
        String(v.numero_nf || "").toLowerCase().includes(buscaLower)
      )
    : vendas;
  const vendasFiltradas = mesFiltro === "todos"
    ? vendasPorBusca
    : vendasPorBusca.filter(v => {
        const d = new Date(v.created_at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === mesFiltro;
      });

  // Build unique months for filter
  const mesesDisponiveis = [...new Set(vendas.map(v => {
    const d = new Date(v.created_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }))].sort().reverse();
  const totalPendente = vendasFiltradas.reduce((s, v) => s + (Number(v.total) - Number(v.valor_pago || 0)), 0);
  const vencidas = vendasFiltradas.filter(v => v.created_at.split("T")[0] < hoje);
  const totalVencido = vencidas.reduce((s, v) => s + (Number(v.total) - Number(v.valor_pago || 0)), 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">A Receber</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={mesFiltro} onValueChange={setMesFiltro}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Filtrar por mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {mesesDisponiveis.map(m => {
                const [ano, mes] = m.split("-");
                const nomesMes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
                return <SelectItem key={m} value={m}>{nomesMes[parseInt(mes) - 1]} {ano}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou NF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Cards de Abatimento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-accent-foreground" />
              Abatimento Individual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs">Venda</Label>
                <Select value={abaterVenda?.id || ""} onValueChange={(id) => { const v = vendas.find(x => x.id === id); setAbaterVenda(v || null); setValorAbater(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a venda..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendas.map((v) => {
                      const rest = Number(v.total) - Number(v.valor_pago || 0);
                      return (
                        <SelectItem key={v.id} value={v.id}>
                          {v.clientes?.nome} - {new Date(v.created_at).toLocaleDateString("pt-BR")} - Restante: R$ {rest.toFixed(2)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {abaterVenda && (
                <div className="rounded-lg bg-muted p-2 text-xs space-y-1">
                  <div className="flex justify-between"><span>Total:</span><span className="font-bold">R$ {Number(abaterVenda.total).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Pago:</span><span className="font-bold text-green-600">R$ {Number(abaterVenda.valor_pago || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Restante:</span><span className="font-black text-amber-600">R$ {(Number(abaterVenda.total) - Number(abaterVenda.valor_pago || 0)).toFixed(2)}</span></div>
                </div>
              )}
              <div>
                <Label className="text-xs font-medium">Forma de pagamento</Label>
                <RadioGroup value={formaPgtoAbater} onValueChange={(v: any) => setFormaPgtoAbater(v)} className="flex gap-3 mt-1">
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="ab-pix" /><Label htmlFor="ab-pix" className="text-xs cursor-pointer">PIX</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="especie" id="ab-esp" /><Label htmlFor="ab-esp" className="text-xs cursor-pointer">Espécie</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="misto" id="ab-mix" /><Label htmlFor="ab-mix" className="text-xs cursor-pointer">Misto</Label></div>
                </RadioGroup>
              </div>
              {formaPgtoAbater === "misto" ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">PIX (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00" value={valorPixAbater} onChange={(e) => setValorPixAbater(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Espécie (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00" value={valorEspecieAbater} onChange={(e) => setValorEspecieAbater(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="text" inputMode="decimal" placeholder="0,00" value={valorAbater} onChange={(e) => setValorAbater(e.target.value)} />
                </div>
              )}
              <Button onClick={abaterValor} disabled={!abaterVenda} className="w-full">
                Abater
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Abatimento em Lote por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs">Cliente</Label>
                <Select value={abatimentoLoteCliente} onValueChange={setAbatimentoLoteCliente}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientesUnicos.map(([id, nome]) => (
                      <SelectItem key={id} value={id}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {abatimentoLoteCliente && totalDevidoClienteLote > 0 && (
                <div className="rounded-lg bg-muted p-2 text-xs space-y-1">
                  <div className="flex justify-between"><span>Total devido:</span><span className="font-bold">R$ {totalDevidoClienteLote.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Contas:</span><span className="font-bold">{vendasDoClienteLote.length}</span></div>
                </div>
              )}
              <div>
                <Label className="text-xs font-medium">Forma de pagamento</Label>
                <RadioGroup value={formaPgtoLote} onValueChange={(v: any) => setFormaPgtoLote(v)} className="flex gap-3 mt-1">
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="lt-pix" /><Label htmlFor="lt-pix" className="text-xs cursor-pointer">PIX</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="especie" id="lt-esp" /><Label htmlFor="lt-esp" className="text-xs cursor-pointer">Espécie</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="misto" id="lt-mix" /><Label htmlFor="lt-mix" className="text-xs cursor-pointer">Misto</Label></div>
                </RadioGroup>
              </div>
              {formaPgtoLote === "misto" ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">PIX (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00" value={valorPixLote} onChange={(e) => setValorPixLote(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Espécie (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00" value={valorEspecieLote} onChange={(e) => setValorEspecieLote(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Valor recebido (R$)</Label>
                  <Input type="text" inputMode="decimal" placeholder="0,00" value={abatimentoLoteValor} onChange={(e) => setAbatimentoLoteValor(e.target.value)} />
                </div>
              )}
              <Button onClick={abaterEmLote} disabled={processandoLote} className="w-full">
                {processandoLote ? "Processando..." : "Abater em Lote"}
              </Button>
              {abatimentoLoteCliente && vendasDoClienteLote.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Ordem de abatimento (mais antiga primeiro):</p>
                  {vendasDoClienteLote.map((v, i) => {
                    const rest = Number(v.total) - Number(v.valor_pago || 0);
                    return (
                      <div key={v.id} className="flex gap-2">
                        <span>{i + 1}.</span>
                        <span>{new Date(v.created_at).toLocaleDateString("pt-BR")}</span>
                        <span>- Restante: <span className="font-bold text-foreground">R$ {rest.toFixed(2)}</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">R$ {totalPendente.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vendasFiltradas.length} venda(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">R$ {totalVencido.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vencidas.length} venda(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em dia</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">R$ {(totalPendente - totalVencido).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vendasFiltradas.length - vencidas.length} venda(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle>Vendas Pendentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Restante</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Situacao</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasFiltradas.map((v) => {
                const isVencida = v.created_at.split("T")[0] < hoje;
                const pago = Number(v.valor_pago || 0);
                const total = Number(v.total);
                const restante = total - pago;
                const temAbatimento = pago > 0 && pago < total;
                return (
                  <TableRow key={v.id}>
                    <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{v.clientes?.nome}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.numero_nf ? v.numero_nf : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>R$ {total.toFixed(2)}</TableCell>
                    <TableCell>
                      {pago > 0 ? (
                        <span className="text-green-600 font-medium">R$ {pago.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${temAbatimento ? "text-amber-600" : ""}`}>
                        R$ {restante.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">{v.forma_pagamento?.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={isVencida ? "destructive" : temAbatimento ? "outline" : "secondary"}>
                        {temAbatimento ? "Parcial" : isVencida ? "Vencida" : "Em dia"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => salvarReciboPDF(v)}
                        title="Gerar Recibo PDF"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => enviarReciboWhatsAppDireto(v)}
                        title="Enviar via WhatsApp"
                        className="text-green-600 hover:text-green-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setHistoricoVenda(v); loadHistorico(v.id); }}
                        title="Historico de abatimentos"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setAbaterVenda(v); setValorAbater(""); }}
                      >
                        <MinusCircle className="h-3.5 w-3.5 mr-1" /> Abater
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmarQuitarId(v.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vendasFiltradas.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Nenhuma venda pendente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Historico de Abatimentos */}
      <Dialog open={!!historicoVenda} onOpenChange={(open) => { if (!open) setHistoricoVenda(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Historico de Abatimentos</DialogTitle>
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
                  <span>Ja pago:</span>
                  <span className="font-bold text-green-600">R$ {Number(historicoVenda.valor_pago || 0).toFixed(2)}</span>
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
                        {h.forma_pagamento && (
                          <p className="text-xs mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {h.forma_pagamento === "misto"
                                ? `PIX R$${Number(h.valor_pix || 0).toFixed(2)} + Espécie R$${Number(h.valor_especie || 0).toFixed(2)}`
                                : h.forma_pagamento === "pix" ? "PIX" : "Espécie"}
                            </Badge>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">R$ {Number(h.valor).toFixed(2)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                          if (!confirm("Excluir este abatimento? O valor será estornado.")) return;
                          try {
                            const valor = Number(h.valor);
                            const { error: delErr } = await (supabase as any).from("abatimentos_historico").delete().eq("id", h.id);
                            if (delErr) throw delErr;
                            const venda = vendas.find(v => v.id === h.venda_id);
                            if (venda) {
                              const novoValorPago = Math.max(0, Number(venda.valor_pago || 0) - valor);
                              await (supabase as any).from("vendas").update({ valor_pago: novoValorPago, status: novoValorPago >= Number(venda.total) ? "paga" : "pendente" }).eq("id", h.venda_id);
                            }
                            toast({ title: "Abatimento excluído" });
                            await loadData();
                            await loadHistorico(h.venda_id);
                          } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
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

      {/* Confirmar Quitar */}
      <AlertDialog open={!!confirmarQuitarId} onOpenChange={(v) => { if (!v) { setConfirmarQuitarId(null); setFormaPgtoQuitar("especie"); setValorPixQuitar(""); setValorEspecieQuitar(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Quitação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {(() => {
                    const v = vendas.find(x => x.id === confirmarQuitarId);
                    if (!v) return "Tem certeza que deseja quitar esta venda?";
                    const restante = Number(v.total) - Number(v.valor_pago || 0);
                    return `Quitar a venda de ${v.clientes?.nome}? Valor restante: R$ ${restante.toFixed(2)}`;
                  })()}
                </p>
                <div>
                  <Label className="text-xs font-medium">Como foi o pagamento?</Label>
                  <RadioGroup value={formaPgtoQuitar} onValueChange={(v: any) => setFormaPgtoQuitar(v)} className="flex gap-3 mt-1">
                    <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="qt-pix" /><Label htmlFor="qt-pix" className="text-xs cursor-pointer">PIX</Label></div>
                    <div className="flex items-center gap-1.5"><RadioGroupItem value="especie" id="qt-esp" /><Label htmlFor="qt-esp" className="text-xs cursor-pointer">Espécie</Label></div>
                    <div className="flex items-center gap-1.5"><RadioGroupItem value="misto" id="qt-mix" /><Label htmlFor="qt-mix" className="text-xs cursor-pointer">Misto</Label></div>
                  </RadioGroup>
                </div>
                {formaPgtoQuitar === "misto" && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">PIX (R$)</Label>
                      <Input type="text" inputMode="decimal" placeholder="0,00" value={valorPixQuitar} onChange={(e) => setValorPixQuitar(e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Espécie (R$)</Label>
                      <Input type="text" inputMode="decimal" placeholder="0,00" value={valorEspecieQuitar} onChange={(e) => setValorEspecieQuitar(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmarQuitarId) { marcarComoPaga(confirmarQuitarId); } }}>
              Confirmar Quitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp Prompt */}
      <AlertDialog open={!!whatsappPrompt} onOpenChange={(v) => !v && setWhatsappPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar recibo por WhatsApp?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Deseja enviar o comprovante para <strong>{whatsappPrompt?.clienteNome}</strong>?</p>
                <div className="rounded-md bg-muted p-2 text-xs space-y-1">
                  <div className="flex justify-between"><span>Total da venda:</span><span className="font-bold">R$ {whatsappPrompt?.total.toFixed(2)}</span></div>
                  {(whatsappPrompt?.valorPago || 0) > 0 && (
                    <div className="flex justify-between"><span>Total pago:</span><span className="font-bold text-green-600">R$ {whatsappPrompt?.valorPago.toFixed(2)}</span></div>
                  )}
                  {!whatsappPrompt?.quitou && (
                    <div className="flex justify-between"><span>Restante:</span><span className="font-bold text-amber-600">R$ {((whatsappPrompt?.total || 0) - (whatsappPrompt?.valorPago || 0)).toFixed(2)}</span></div>
                  )}
                  {(whatsappPrompt?.historico?.length || 0) > 0 && (
                    <div className="border-t pt-1 mt-1">
                      <p className="font-semibold mb-0.5">Historico ({whatsappPrompt?.historico.length} pagamento(s)):</p>
                      {whatsappPrompt?.historico.map((h, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                          <span>{h.data}</span><span>R$ {h.valor.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nao</AlertDialogCancel>
            <AlertDialogAction onClick={enviarReciboWhatsApp} className="bg-green-600 hover:bg-green-700">
              Enviar WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
