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
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
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

  const useLogo = branding?.factoryLogoUrl || logoUrl;
  const displayName = branding?.factoryName || "ICETECH";

  // Logo
  try {
    const base64 = await loadImageAsBase64(useLogo);
    doc.addImage(base64, "PNG", 14, 8, 30, 30);
  } catch {
    // sem logo
  }

  // Header ao lado da logo
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 50, 20);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(displayName, 50, 26);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR")}`, 50, 31);
  doc.setTextColor(0);

  // Linha separadora
  doc.setDrawColor(0, 100, 160);
  doc.setLineWidth(0.8);
  doc.line(14, 40, 196, 40);

  let currentY = 44;

  // Capturar e adicionar gráficos se houver container
  if (chartContainerId) {
    const chartContainer = document.getElementById(chartContainerId);
    if (chartContainer) {
      const chartCards = chartContainer.querySelectorAll<HTMLElement>("[data-chart-export]");
      const elements = chartCards.length > 0 ? Array.from(chartCards) : [chartContainer];

      for (const el of elements) {
        const imgData = await captureChartElement(el);
        if (imgData) {
          const imgWidth = 180;
          const imgHeight = (el.offsetHeight * imgWidth) / el.offsetWidth;
          const scaledHeight = Math.min(imgHeight, 120);

          if (currentY + scaledHeight > 275) {
            doc.addPage();
            currentY = 15;
          }

          doc.addImage(imgData, "PNG", 14, currentY, imgWidth, scaledHeight);
          currentY += scaledHeight + 6;
        }
      }

      if (currentY > 50) {
        if (currentY + 10 > 275) {
          doc.addPage();
          currentY = 15;
        }
        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(14, currentY, 196, currentY);
        currentY += 6;
      }
    }
  }

  // Tabela
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: currentY,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 100, 160], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 248, 255] },
  });

  // Totais no final
  if (totals && totals.length > 0) {
    const finalY = (doc as any).previousAutoTable?.finalY || (doc as any).lastAutoTable?.finalY || 60;
    let y = finalY + 10;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(0, 100, 160);
    doc.setLineWidth(0.5);
    doc.line(14, y - 4, 196, y - 4);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAIS", 14, y + 2);
    y += 8;

    doc.setFontSize(9);
    totals.forEach((t) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${t.label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(t.value, 60, y);
      y += 6;
    });
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`${displayName} - Pagina ${i}/${pageCount}`, 14, 290);
    doc.text("Sistema de Gestao", 170, 290);
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
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
