import { useCallback, useEffect, useState } from "react";

/**
 * Ola 6 — Slice G (AC6)
 * Pista de acciones recientes del POS por org/cajero. Persiste en localStorage
 * para que tras un refresco o cambio de turno la barra muestre lo último que
 * el operador hizo (suspender, NC, abrir cajón, sync, venta completada).
 *
 * No serializa callbacks: sólo guarda un `type` que el workspace mapea a su
 * handler real al re-disparar.
 */
const MAX_RECENT = 8;

export type RecentActionType =
  | "park"
  | "nc"
  | "ventas"
  | "cajon"
  | "refresh"
  | "sale_complete";

export interface RecentAction {
  id: string;
  type: RecentActionType;
  label: string;
  ts: number;
  meta?: Record<string, unknown>;
}

export function useRecentActions(scopeKey: string | null) {
  const key = scopeKey ? `sistecpos:pos:recent-actions:${scopeKey}` : null;
  const [actions, setActions] = useState<RecentAction[]>([]);

  useEffect(() => {
    if (!key) {
      setActions([]);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      setActions(raw ? (JSON.parse(raw) as RecentAction[]) : []);
    } catch {
      setActions([]);
    }
  }, [key]);

  const push = useCallback(
    (entry: Omit<RecentAction, "id" | "ts">) => {
      if (!key) return;
      setActions((prev) => {
        const next: RecentAction[] = [
          { ...entry, id: crypto.randomUUID(), ts: Date.now() },
          ...prev,
        ].slice(0, MAX_RECENT);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setActions([]);
  }, [key]);

  return { actions, push, clear };
}
