import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";

/**
 * Indicador fixo no canto inferior: mostra status offline e pendências
 * na fila de sincronização. Permite forçar sync manualmente.
 */
export default function OfflineIndicator() {
  const { online, pending, syncing, sync } = useOfflineSync();

  if (online && pending === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-xs">
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm ${
          online
            ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
            : "bg-destructive/15 border-destructive/40 text-destructive"
        }`}
        role="status"
        aria-live="polite"
      >
        {online ? (
          <CloudUpload className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <span className="text-xs font-medium">
          {online
            ? `${pending} ${pending === 1 ? "operação pendente" : "operações pendentes"}`
            : `Offline${pending > 0 ? ` (${pending} na fila)` : ""}`}
        </span>
        {online && pending > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={sync}
            disabled={syncing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        )}
      </div>
    </div>
  );
}