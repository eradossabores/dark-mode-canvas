import { useEffect, useState, useCallback } from "react";
import { countPending, flushQueue, subscribeQueue } from "@/lib/offlineQueue";

export function useOfflineSync() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setPending(await countPending());
    } catch {
      /* IndexedDB indisponível (modo privado) - ignora */
    }
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return { ok: 0, failed: 0 };
    setSyncing(true);
    try {
      const r = await flushQueue();
      await refreshCount();
      return r;
    } finally {
      setSyncing(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    const unsub = subscribeQueue(refreshCount);
    const onOnline = () => {
      setOnline(true);
      sync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Tentar sync ao montar (caso tenha ficado pendência da última sessão)
    if (navigator.onLine) sync();
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshCount, sync]);

  return { online, pending, syncing, sync };
}