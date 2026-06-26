import { useCallback, useEffect, useState } from "react";

const MAX_RECENT = 8;

/**
 * Ola 6 — Slice C
 * Tracks recently added products per org/session in localStorage so
 * cashiers can re-add common items in one tap.
 */
export function useRecentProducts(scopeKey: string | null) {
  const key = scopeKey ? `sistecpos:pos:recent:${scopeKey}` : null;
  const [recent, setRecent] = useState<string[]>([]);

  // Load on mount / scope change
  useEffect(() => {
    if (!key) {
      setRecent([]);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      setRecent(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecent([]);
    }
  }, [key]);

  const push = useCallback(
    (productId: string) => {
      if (!key || !productId) return;
      setRecent((prev) => {
        const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_RECENT);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
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
    setRecent([]);
  }, [key]);

  return { recent, push, clear };
}
