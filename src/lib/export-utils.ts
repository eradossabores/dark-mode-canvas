import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import logoUrl from "@/assets/logo.png";

export interface PDFBranding {
  factoryName?: string;
  factoryLogoUrl?: string | null;
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

async function captureChartElement(element: HTMLElement): Promise<string | null> {
  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("Erro ao capturar gráfico:", e);
    return null;
  }
}

export async function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  totals?: { label: string; value: string }[],
  chartContainerId?: string,
  branding?: PDFBranding
) {
  const doc = new jsPDF();
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 14;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const useLogo = branding?.factoryLogoUrl || logoUrl;
  const displayName = branding?.factoryName || "ICETECH";

  // ── Header com logo ──
  try {
    const base64 = await loadImageAsBase64(useLogo);
    doc.addImage(base64, "PNG", MARGIN, 8, 28, 28);
  } catch {
    // sem logo
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 48, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(displayName, 48, 25);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
    48,
    31
  );
  doc.setTextColor(0);

  // Linha separadora colorida
  doc.setDrawColor(0, 100, 160);
  doc.setLineWidth(1);
  doc.line(MARGIN, 40, MARGIN + CONTENT_W, 40);

  let currentY = 46;

  // ── Totais / KPIs no topo ──
  if (totals && totals.length > 0) {
    const cardW = CONTENT_W / Math.min(totals.length, 4);
    const cardH = 18;

    doc.setDrawColor(220);
    doc.setLineWidth(0.3);

    totals.forEach((t, idx) => {
      const x = MARGIN + (idx % 4) * cardW;
      const row = Math.floor(idx / 4);
      const y = currentY + row * (cardH + 2);

      // Card background
      doc.setFillColor(245, 248, 255);
      doc.roundedRect(x + 1, y, cardW - 2, cardH, 2, 2, "F");

      // Label
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(t.label.toUpperCase(), x + 4, y + 6);

      // Value
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 80, 140);
      doc.text(t.value, x + 4, y + 13);
    });

    doc.setTextColor(0);
    const totalRows = Math.ceil(totals.length / 4);
    currentY += totalRows * (cardH + 2) + 6;
  }

  // ── Gráficos ──
  if (chartContainerId) {
    const chartContainer = document.getElementById(chartContainerId);
    if (chartContainer) {
      const chartCards = chartContainer.querySelectorAll<HTMLElement>("[data-chart-export]");
      const elements = chartCards.length > 0 ? Array.from(chartCards) : [chartContainer];

      for (const el of elements) {
        const imgData = await captureChartElement(el);
        if (imgData) {
          const imgWidth = CONTENT_W;
          const aspectRatio = el.offsetHeight / el.offsetWidth;
          const imgHeight = Math.min(imgWidth * aspectRatio, 110);

          if (currentY + imgHeight > PAGE_H - 25) {
            doc.addPage();
            currentY = MARGIN;
          }

          doc.addImage(imgData, "PNG", MARGIN, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 5;
        }
      }

      if (currentY > 50) {
        if (currentY + 8 > PAGE_H - 25) {
          doc.addPage();
          currentY = MARGIN;
        }
        doc.setDrawColor(210);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, currentY, MARGIN + CONTENT_W, currentY);
        currentY += 6;
      }
    }
  }

  // ── Tabela de dados ──
  if (rows.length > 0) {
    if (currentY + 30 > PAGE_H - 25) {
      doc.addPage();
      currentY = MARGIN;
    }

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: currentY,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [0, 100, 160],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: [245, 248, 255],
      },
      columnStyles: (() => {
        const cs: Record<number, any> = {};
        headers.forEach((h, i) => {
          const lower = h.toLowerCase();
          if (lower.includes("valor") || lower.includes("total") || lower.includes("preço") || lower.includes("preco") || lower.includes("r$")) {
            cs[i] = { halign: "right", fontStyle: "bold" };
          }
          if (lower.includes("qtd") || lower.includes("quantidade") || lower.includes("unidades")) {
            cs[i] = { halign: "center" };
          }
        });
        return cs;
      })(),
      didDrawPage: (data: any) => {
        // Mini header em páginas adicionais
        if (data.pageNumber > 1) {
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(`${title} (cont.)`, MARGIN, 10);
          doc.setTextColor(0);
        }
      },
    });
  }

  // ── Rodapé em todas as páginas ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Linha fina acima do rodapé
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 15, MARGIN + CONTENT_W, PAGE_H - 15);

    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(`${displayName} — Sistema de Gestão`, MARGIN, PAGE_H - 10);
    doc.text(`Página ${i} de ${pageCount}`, MARGIN + CONTENT_W, PAGE_H - 10, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`${filename}.pdf`);
}

export function exportToExcel(
  headers: string[],
  rows: (string | number)[][],
  sheetName: string,
  filename: string
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
