import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

export type ChecklistItem = { item_key: string; done: boolean; notes: string | null };

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

/**
 * Persistencia del checklist diario en Supabase.
 * - Se reinicia automáticamente al cambiar la fecha (clave: organization + user + day).
 * - Mantiene fallback en localStorage para resiliencia offline.
 */
export function useDailyChecklist(defaults: { item_key: string; label: string }[]) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const userId = user?.id;
  const day = todayISO();

  const lsKey = useMemo(
    () => `sistecpos:diario:${orgId ?? "_"}:${userId ?? "_"}:${day}`,
    [orgId, userId, day],
  );

  const [items, setItems] = useState<Record<string, ChecklistItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hidratar: localStorage primero (instantáneo), luego Supabase
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    try {
      const cached = JSON.parse(localStorage.getItem(lsKey) || "{}");
      if (cached && typeof cached === "object") setItems(cached);
    } catch {
      /* noop */
    }

    if (!orgId || !userId) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: err } = await supabase
        .from("daily_checklist")
        .select("item_key, done, notes")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("day", day);

      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const map: Record<string, ChecklistItem> = {};
      for (const def of defaults) {
        map[def.item_key] = { item_key: def.item_key, done: false, notes: null };
      }
      for (const row of data ?? []) {
        map[row.item_key] = {
          item_key: row.item_key,
          done: !!row.done,
          notes: row.notes ?? null,
        };
      }
      setItems(map);
      localStorage.setItem(lsKey, JSON.stringify(map));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId, day, lsKey]);

  const persist = async (item_key: string, patch: Partial<ChecklistItem>) => {
    if (!orgId || !userId) return;
    const next = {
      ...items,
      [item_key]: {
        item_key,
        done: patch.done ?? items[item_key]?.done ?? false,
        notes: patch.notes ?? items[item_key]?.notes ?? null,
      },
    };
    setItems(next);
    localStorage.setItem(lsKey, JSON.stringify(next));

    const { error: err } = await supabase
      .from("daily_checklist")
      .upsert(
        {
          organization_id: orgId,
          user_id: userId,
          day,
          item_key,
          done: next[item_key].done,
          notes: next[item_key].notes,
        },
        { onConflict: "organization_id,user_id,day,item_key" },
      );
    if (err) setError(err.message);
  };

  const toggle = (item_key: string) =>
    persist(item_key, { done: !(items[item_key]?.done ?? false) });
  const setNotes = (item_key: string, notes: string) => persist(item_key, { notes });

  const doneCount = Object.values(items).filter((i) => i.done).length;

  return { items, loading, error, toggle, setNotes, doneCount, day };
}
