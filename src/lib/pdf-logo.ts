import type jsPDF from "jspdf";
import originalLogo from "@/assets/dpraia-ice-original.png.asset.json";
import previousLogo from "@/assets/dpraia-ice-logo.png.asset.json";

/** Only replace D'Praia's legacy logo; other factories retain their identity. */
export function resolvePdfLogo(url?: string | null): string {
  return !url || url.split("?")[0] === previousLogo.url
    ? originalLogo.url
    : url;
}

/** Flatten transparency on paper before embedding: avoids black alpha artifacts. */
export function loadPdfLogo(url?: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível preparar a logomarca.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) { reject(error); }
    };
    img.onerror = () => reject(new Error("Não foi possível carregar a logomarca."));
    img.src = resolvePdfLogo(url);
  });
}

/** Fit the original proportions inside the existing header without cropping. */
export function addPdfLogo(doc: jsPDF, image: string, x: number, y: number, boxWidth: number, boxHeight: number): void {
  const { width, height } = doc.getImageProperties(image);
  if (width <= 0 || height <= 0) throw new Error("Logomarca inválida.");
  const scale = Math.min(boxWidth / width, boxHeight / height);
  const w = width * scale;
  const h = height * scale;
  doc.addImage(image, "PNG", x + (boxWidth - w) / 2, y + (boxHeight - h) / 2, w, h);
}