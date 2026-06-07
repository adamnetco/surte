import { useEffect, useState } from "react";
import { flushOutbox, pendingCount, enqueue as enqueueOp } from "@/modules/offline/lib/outbox";
import { offlineDB, getMeta, type OutboxOp } from "@/modules/offline/lib/db";

/**
 * Background sync service hook.
 * - Monitors online/offline transitions.
 * - Polls the Dexie `outbox` table for pending items.
 * - Triggers `flushOutbox()` (which applies exponential backoff + retries).
 * Use one instance high in the tree (e.g., POSWorkspace shell).
 */
export interface SyncState {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

export function useSyncService(opts: { pollMs?: number } = {}) {
  const pollMs = opts.pollMs ?? 5_000;
  const [state, setState] = useState<SyncState>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pending: 0,
    failed: 0,
    syncing: false,
    lastSyncAt: null,
    lastError: null,
  });

  // Online/offline transitions.
  useEffect(() => {
    const up = () => {
      setState((s) => ({ ...s, online: true }));
      void runFlush();
    };
    const down = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Process the queue, capturing UI state.
  const runFlush = async () => {
    setState((s) => ({ ...s, syncing: true }));
    try {
      const res = await flushOutbox();
      const failedRows = await offlineDB.outbox.where("status").equals("failed").toArray();
      const lastError = failedRows.length ? (failedRows[failedRows.length - 1].last_error ?? null) : null;
      setState((s) => ({
        ...s,
        syncing: false,
        lastSyncAt: Date.now(),
        failed: res.failed,
        lastError,
      }));
    } catch (e: any) {
      setState((s) => ({ ...s, syncing: false, lastError: String(e?.message ?? e) }));
    }
  };

  // Poll outbox length + opportunistic flush.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const n = await pendingCount();
      if (cancelled) return;
      setState((s) => ({ ...s, pending: n }));
      if (n > 0 && navigator.onLine) void runFlush();
    };
    void tick();
    const id = setInterval(tick, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [pollMs]);

  // Hydrate lastSyncAt from persisted meta on mount.
  useEffect(() => {
    getMeta<number>("last_sync_success_at").then((ts) => {
      if (ts) setState((s) => ({ ...s, lastSyncAt: ts }));
    }).catch(() => { /* dexie unavailable */ });
  }, []);

  // Enqueue helper bound to this hook for ergonomic consumption.
  const enqueue = async (op: OutboxOp, payload: any, organization_id: string) => {
    const uuid = await enqueueOp(op, payload, organization_id);
    const n = await pendingCount();
    setState((s) => ({ ...s, pending: n }));
    return uuid;
  };

  return { ...state, flushNow: runFlush, enqueue };
}
