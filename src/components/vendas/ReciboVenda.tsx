import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, MessageCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoRecibo from "@/assets/logo-recibo.png";
import { useAuth } from "@/contexts/AuthContext";

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
  const { branding, factoryName } = useAuth();
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

  if (!data) return null;

  function drawDottedLine(doc: jsPDF, x1: number, yy: number, x2: number) {
    for (let x = x1; x < x2; x += 1.5) {
      doc.line(x, yy, x + 0.5, yy);
    }
  }

  function gerarPDFDoc(): jsPDF | null {
    if (!data) return null;
    const doc = new jsPDF({ unit: "mm", format: [80, 240] });
    const w = 80;
    let y = 4;

    // Top band
    doc.setFillColor(0, 100, 160);
    doc.rect(0, 0, w, 3, "F");
    y = 6;

    // Logo
    const logoW = 36;
    const logoH = 28;
    try {
      doc.addImage(factoryLogo, "PNG", (w - logoW) / 2, y, logoW, logoH);
    } catch { /* fallback: no logo */ }
    y += logoH + 2;

    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "italic");
    doc.text(factoryName || "Gelos Saborizados", w / 2, y, { align: "center" });
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

    infoLabel("Cliente:", data.cliente_nome, y); y += 3.5;
    infoLabel("Data:", data.data, y); y += 3.5;
    infoLabel("Pgto:", data.forma_pagamento, y); y += 3.5;
    if (data.numero_nf) { infoLabel("NF:", data.numero_nf, y); y += 3.5; }
    y += 2;

    doc.setDrawColor(200, 200, 200);
    drawDottedLine(doc, 6, y, w - 6);
    y += 3;

    // Items table
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

    // Quantity badge
    const totalQtd = data.itens.reduce((s, i) => s + i.quantidade, 0);
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
    doc.text(`TOTAL: R$ ${data.total.toFixed(2)}`, w / 2, y + 5.5, { align: "center" });
    y += 13;

    // Payment status
    const isPago = data.status === "paga";
    const valorPago = data.valor_pago ?? (isPago ? data.total : 0);
    const restante = data.total - valorPago;

    if (valorPago > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 139, 34);
      doc.text(`Pago: R$ ${valorPago.toFixed(2)}`, 6, y);
      y += 4;
    }

    if (!isPago && restante > 0) {
      doc.setTextColor(200, 120, 0);
      doc.text(`Restante: R$ ${restante.toFixed(2)}`, 6, y);
      y += 4;
    }
    y += 2;

    if (data.observacoes) {
      doc.setDrawColor(200, 200, 200);
      drawDottedLine(doc, 6, y, w - 6);
      y += 3;
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text(`Obs: ${data.observacoes}`, 6, y, { maxWidth: w - 12 });
      y += 6;
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

    const msg = `*A ERA DOS SABORES*\n\nOla ${data.cliente_nome}, segue seu recibo.\n\nTotal: R$ ${data.total.toFixed(2)}\nData: ${data.data}\nPagamento: ${data.forma_pagamento}`;

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: msg, files: [file] });
        return;
      } catch (e) {
        console.log("Share cancelled, falling back to wa.me");
      }
    }

    doc.save(fileName);
    const phone = data.telefone?.replace(/\D/g, "") || "";
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg + "\n\n_Recibo PDF baixado no seu dispositivo._")}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibo da Venda</DialogTitle>
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

          <div className={`text-center py-3 rounded-lg font-bold text-lg ${data.status === "paga" ? "bg-green-100 text-green-700 border-2 border-green-400" : "bg-amber-100 text-amber-700 border-2 border-amber-400"}`}>
            {data.status === "paga" ? "PAGO" : "PENDENTE"}
          </div>

          {data.valor_pago !== undefined && data.valor_pago > 0 && data.status !== "paga" && (
            <div className="text-xs text-muted-foreground text-center space-y-0.5">
              <p>Pago: R$ {data.valor_pago.toFixed(2)}</p>
              <p className="font-bold text-amber-600">Restante: R$ {(data.total - data.valor_pago).toFixed(2)}</p>
            </div>
          )}

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
