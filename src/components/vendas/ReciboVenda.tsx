import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, MessageCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoRecibo from "@/assets/logo-recibo.png";

interface ReciboItem {
  sabor_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface ReciboData {
  cliente_nome: string;
  data: string;
  forma_pagamento: string;
  numero_nf?: string;
  total: number;
  itens: ReciboItem[];
  observacoes?: string;
  telefone?: string;
  status?: "pendente" | "paga" | "cancelada";
  valor_pago?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReciboData | null;
}

export default function ReciboVenda({ open, onOpenChange, data }: Props) {
  if (!data) return null;

  function gerarPDFDoc(): jsPDF | null {
    if (!data) return null;
    const doc = new jsPDF({ unit: "mm", format: [80, 220] });
    const w = 80;
    let y = 4;

    // Logo
    const logoW = 40;
    const logoH = 32;
    doc.addImage(logoRecibo, "PNG", (w - logoW) / 2, y, logoW, logoH);
    y += logoH + 2;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Cor, Cheiro e Sabor da Fruta", w / 2, y, { align: "center" });
    y += 3;
    doc.text("Tel: (95) 99172-5677", w / 2, y, { align: "center" });
    y += 5;

    doc.setLineWidth(0.3);
    doc.line(4, y, w - 4, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE VENDA", w / 2, y, { align: "center" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Cliente: ${data.cliente_nome}`, 4, y); y += 4;
    doc.text(`Data: ${data.data}`, 4, y); y += 4;
    doc.text(`Pagamento: ${data.forma_pagamento}`, 4, y); y += 4;
    if (data.numero_nf) { doc.text(`NF: ${data.numero_nf}`, 4, y); y += 4; }

    doc.line(4, y, w - 4, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 4, right: 4 },
      head: [["Sabor", "Qtd", "Unit.", "Subtotal"]],
      body: data.itens.map(i => [
        i.sabor_nome,
        String(i.quantidade),
        `R$${i.preco_unitario.toFixed(2)}`,
        `R$${i.subtotal.toFixed(2)}`,
      ]),
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 136, 204], fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 8, halign: "center" },
        2: { cellWidth: 16, halign: "right" },
        3: { cellWidth: 18, halign: "right" },
      },
      theme: "grid",
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    doc.line(4, y, w - 4, y);
    y += 5;

    const totalQtd = data.itens.reduce((s, i) => s + i.quantidade, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Quantidade Total: ${totalQtd} unidades`, w / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: R$ ${data.total.toFixed(2)}`, w / 2, y, { align: "center" });
    y += 6;

    // Status de pagamento
    const isPago = data.status === "paga";
    const valorPago = data.valor_pago ?? (isPago ? data.total : 0);
    const restante = data.total - valorPago;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Valor Pago: R$ ${valorPago.toFixed(2)}`, 4, y); y += 4;
    if (!isPago && restante > 0) {
      doc.text(`Restante: R$ ${restante.toFixed(2)}`, 4, y); y += 4;
    }
    doc.text(`Status: ${isPago ? "PAGO" : "PENDENTE"}`, 4, y); y += 5;

    if (data.observacoes) {
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Obs: ${data.observacoes}`, 4, y, { maxWidth: w - 8 });
      y += 6;
    }

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text("Obrigado pela preferência!", w / 2, y, { align: "center" });
    y += 6;

    // Carimbo PAGO
    if (isPago) {
      const centerX = w / 2;
      const centerY = y + 8;
      doc.setDrawColor(34, 139, 34);
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

  function gerarPDF() {
    const doc = gerarPDFDoc();
    if (!doc || !data) return;
    doc.save(`recibo-${data.cliente_nome.replace(/\s+/g, "-")}.pdf`);
  }

  async function enviarWhatsApp() {
    if (!data) return;

    const doc = gerarPDFDoc();
    if (!doc) return;

    const pdfBlob = doc.output("blob");
    const fileName = `recibo-${data.cliente_nome.replace(/\s+/g, "-")}.pdf`;
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });

    const msg = `🧊 *A ERA DOS SABORES*\n\nOlá ${data.cliente_nome}, segue seu recibo.\n\nTotal: R$ ${data.total.toFixed(2)}\nData: ${data.data}\nPagamento: ${data.forma_pagamento}`;

    // Try Web Share API (attaches file on mobile/desktop)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: msg, files: [file] });
        return;
      } catch (e) {
        // User cancelled or share failed, fall back
        console.log("Share cancelled, falling back to wa.me");
      }
    }

    // Fallback: download PDF + open WhatsApp with text only
    doc.save(fileName);
    const phone = data.telefone?.replace(/\D/g, "") || "";
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg + "\n\n📎 _Recibo PDF baixado no seu dispositivo._")}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🧾 Recibo da Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="text-center border-b pb-3">
            <img src={logoRecibo} alt="A Era dos Sabores" className="h-28 mx-auto mb-1" />
            <p className="text-muted-foreground text-xs">Cor, Cheiro e Sabor da Fruta</p>
            <p className="text-muted-foreground text-xs">Tel: (95) 99172-5677</p>
          </div>

          <div className="space-y-1">
            <p><strong>Cliente:</strong> {data.cliente_nome}</p>
            <p><strong>Data:</strong> {data.data}</p>
            <p><strong>Pagamento:</strong> {data.forma_pagamento}</p>
            {data.numero_nf && <p><strong>NF:</strong> {data.numero_nf}</p>}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Sabor</th>
                  <th className="text-center p-2">Qtd</th>
                  <th className="text-right p-2">Unit.</th>
                  <th className="text-right p-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{item.sabor_nome}</td>
                    <td className="text-center p-2">{item.quantidade}</td>
                    <td className="text-right p-2">R$ {item.preco_unitario.toFixed(2)}</td>
                    <td className="text-right p-2">R$ {item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-right font-bold text-lg border-t pt-2">
            TOTAL: R$ {data.total.toFixed(2)}
          </div>

          <div className="text-right text-sm text-muted-foreground">
            Quantidade Total: {data.itens.reduce((s, i) => s + i.quantidade, 0)} unidades
          </div>

          {data.observacoes && (
            <p className="text-xs text-muted-foreground">Obs: {data.observacoes}</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={gerarPDF} className="flex-1">
            <Printer className="h-4 w-4 mr-1" /> Imprimir PDF
          </Button>
          <Button onClick={enviarWhatsApp} variant="outline" className="flex-1 text-white bg-blue-600 hover:bg-blue-700 border-blue-600">
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
