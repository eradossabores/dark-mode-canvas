import type jsPDF from "jspdf";
import originalLogo from "@/assets/dpraia-ice-logo-v2.png.asset.json";
import legacyOriginalLogo from "@/assets/dpraia-ice-original.png.asset.json";
import previousLogo from "@/assets/dpraia-ice-logo.png.asset.json";
// Pre-sized (700px, white background) copy bundled with the app: no 1.8 MB
// download on the phone, so PDFs never go out without the D'Praia logo.
import dpraiaPdfLogo from "@/assets/dpraia-ice-logo-pdf.jpg";

const DPRAIA_URLS = new Set([originalLogo.url, previousLogo.url, legacyOriginalLogo.url]);

/**
 * Longest side (px) of the image embedded in PDFs. ~900px is still sharp at
 * print size but keeps receipts small enough to share on WhatsApp from a phone
 * (the original upload is ~1.8 MB and produced ~10 MB PDFs).
 */
const MAX_LOGO_PX = 900;

/** One in-flight/finished load per URL, so pages can reuse the prepared logo. */
const logoCache = new Map<string, Promise<string>>();

/** Only D'Praia's logos use the bundled copy; other factories retain their identity. */
export function resolvePdfLogo(url?: string | null): string {
  return !url || DPRAIA_URLS.has(url.split("?")[0])
    ? dpraiaPdfLogo
    : url;
}

function renderLogo(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_LOGO_PX / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível preparar a logomarca.");
        // Flatten transparency on paper before embedding: avoids black alpha artifacts.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.92);
        if (!data.startsWith("data:image/")) throw new Error("Logomarca inválida.");
        resolve(data);
      } catch (error) { reject(error); }
    };
    img.onerror = () => reject(new Error("Não foi possível carregar a logomarca."));
    img.src = src;
  });
}

/** Load (once per URL) the logo as a paper-flattened, size-limited image for jsPDF. */
export function loadPdfLogo(url?: string | null): Promise<string> {
  const src = resolvePdfLogo(url);
  let pending = logoCache.get(src);
  if (!pending) {
    pending = renderLogo(src);
    logoCache.set(src, pending);
    // Allow a retry later (e.g. phone was offline) instead of caching the failure.
    pending.catch(() => logoCache.delete(src));
  }
  return pending;
}

/**
 * Return the already-prepared logo, or wait for it when the user generates a
 * PDF before the background load finished. Never throws: "" means "no logo".
 */
export async function ensurePdfLogo(current: string, url?: string | null): Promise<string> {
  if (current) return current;
  try {
    return await loadPdfLogo(url);
  } catch {
    return "";
  }
}

/** Fit the original proportions inside the existing header without cropping. */
export function addPdfLogo(doc: jsPDF, image: string, x: number, y: number, boxWidth: number, boxHeight: number): void {
  if (!image) throw new Error("Logomarca indisponível.");
  const { width, height } = doc.getImageProperties(image);
  if (width <= 0 || height <= 0) throw new Error("Logomarca inválida.");
  const scale = Math.min(boxWidth / width, boxHeight / height);
  const w = width * scale;
  const h = height * scale;
  const format = image.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  doc.addImage(image, format, x + (boxWidth - w) / 2, y + (boxHeight - h) / 2, w, h);
}
