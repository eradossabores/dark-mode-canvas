import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunks after a new deploy (PWA/CDN cache mismatch).
// When a dynamic import fails, purge caches + SW and hard reload once.
const CHUNK_RELOAD_KEY = "__chunk_reload_at";
function handleChunkError(message?: string) {
  if (!message) return;
  const isChunkErr =
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message);
  if (!isChunkErr) return;
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - last < 10_000) return; // avoid reload loops
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  (async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}
    window.location.reload();
  })();
}
window.addEventListener("error", (e) => handleChunkError(e?.message));
window.addEventListener("unhandledrejection", (e: any) =>
  handleChunkError(e?.reason?.message || String(e?.reason || ""))
);

createRoot(document.getElementById("root")!).render(
  <App />
);
