import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fila offline para operações críticas em campo (fábrica/celular com sinal instável).
 * Estratégia: tenta executar online; se falhar por rede, enfileira em IndexedDB e
 * sincroniza ao detectar 'online' novamente.
 */

export type PendingOpType =
  | "presenca_confirmar"
  | "presenca_remover"
  | "producao_registrar"
  | "rpc_generico";

export interface PendingOp {
  id?: number;
  type: PendingOpType;
  payload: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const DB_NAME = "macuxi_offline";
const STORE = "pending_ops";
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(op: Omit<PendingOp, "id" | "createdAt" | "attempts">) {
  const db = await getDB();
  const full: PendingOp = { ...op, createdAt: Date.now(), attempts: 0 };
  await db.add(STORE, full);
  notifyChange();
}

export async function listPending(): Promise<PendingOp[]> {
  const db = await getDB();
  return (await db.getAll(STORE)) as PendingOp[];
}

export async function countPending(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}

export async function removeOp(id: number) {
  const db = await getDB();
  await db.delete(STORE, id);
  notifyChange();
}

async function executeOp(op: PendingOp): Promise<void> {
  switch (op.type) {
    case "presenca_confirmar": {
      const { error } = await (supabase as any)
        .from("presenca_producao")
        .insert(op.payload);
      if (error) throw error;
      return;
    }
    case "presenca_remover": {
      const { error } = await (supabase as any)
        .from("presenca_producao")
        .delete()
        .eq("id", op.payload.id);
      if (error) throw error;
      return;
    }
    case "producao_registrar": {
      const { error } = await (supabase as any).rpc("realizar_producao", op.payload);
      if (error) throw error;
      return;
    }
    case "rpc_generico": {
      const { fn, args } = op.payload;
      const { error } = await (supabase as any).rpc(fn, args);
      if (error) throw error;
      return;
    }
  }
}

function isNetworkError(e: any) {
  if (!navigator.onLine) return true;
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("offline")
  );
}

/**
 * Tenta executar online. Se falhar por rede, enfileira e devolve {queued:true}.
 * Para outros erros (validação/RLS), propaga.
 */
export async function runOrEnqueue(
  op: Omit<PendingOp, "id" | "createdAt" | "attempts">
): Promise<{ queued: boolean }> {
  if (!navigator.onLine) {
    await enqueue(op);
    return { queued: true };
  }
  try {
    await executeOp({ ...op, createdAt: Date.now(), attempts: 0 });
    return { queued: false };
  } catch (e: any) {
    if (isNetworkError(e)) {
      await enqueue(op);
      return { queued: true };
    }
    throw e;
  }
}

/** Tenta sincronizar todas as operações pendentes. Retorna quantas foram processadas. */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (!navigator.onLine) return { ok: 0, failed: 0 };
  const ops = await listPending();
  let ok = 0;
  let failed = 0;
  for (const op of ops) {
    try {
      await executeOp(op);
      if (op.id != null) await removeOp(op.id);
      ok++;
    } catch (e: any) {
      failed++;
      const db = await getDB();
      await db.put(STORE, {
        ...op,
        attempts: op.attempts + 1,
        lastError: String(e?.message || e),
      });
      // Se erro não for de rede, para de tentar para evitar loop
      if (!isNetworkError(e)) break;
    }
  }
  notifyChange();
  return { ok, failed };
}

// Pub/sub simples para hooks reagirem a mudanças na fila
const listeners = new Set<() => void>();
function notifyChange() {
  listeners.forEach((l) => {
    try { l(); } catch { /* noop */ }
  });
}
export function subscribeQueue(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}