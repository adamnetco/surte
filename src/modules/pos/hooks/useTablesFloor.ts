import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";

/**
 * Hook compartido para vistas de salón (Mesas full-page + POS panel embebido).
 * Centraliza fetch + realtime de `dining_areas` / `dining_tables` / `table_orders`
 * y unifica el mapeo de órdenes por mesa para que ambas vistas se comporten igual.
 */

export interface Area {
  id: string;
  name: string;
  color: string | null;
}

export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  status: string;
  dining_area_id: string | null;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  shape?: string;
  location_id?: string | null;
}

export interface OpenOrder {
  id: string;
  dining_table_id: string | null;
  total: number;
  opened_at: string;
  sub_label: string | null;
}

interface Options {
  /** Si se pasa `withCoords`, se traen pos_x/y/width/height/shape/location_id para el editor visual. */
  withCoords?: boolean;
}

export function useTablesFloor(organizationId: string | undefined, opts: Options = {}) {
  const { withCoords = false } = opts;
  const [areas, setAreas] = useState<Area[]>([]);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const tableCols = withCoords
    ? "id,label,capacity,pos_x,pos_y,width,height,shape,status,dining_area_id,location_id"
    : "id,label,capacity,status,dining_area_id";

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [{ data: a }, { data: t }, { data: o }] = await Promise.all([
      supabase
        .from("dining_areas")
        .select("id,name,color")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("dining_tables")
        .select(tableCols)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("label"),
      supabase
        .from("table_orders")
        .select("id,dining_table_id,total,opened_at,sub_label")
        .eq("organization_id", organizationId)
        .in("status", ["open", "sent", "billed"]),
    ]);
    setAreas((a as Area[]) ?? []);
    setTables((t as FloorTable[]) ?? []);
    setOpenOrders((o as OpenOrder[]) ?? []);
    setLoading(false);
  }, [organizationId, tableCols]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!organizationId) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(uniqueTopic(`floor-${organizationId}`))
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "table_orders", filter: `organization_id=eq.${organizationId}` },
          load,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dining_tables", filter: `organization_id=eq.${organizationId}` },
          load,
        )
        .subscribe();
    } catch (err) {
      console.warn("[useTablesFloor] realtime subscribe failed", err);
    }
    return () => {
      safeRemoveChannel(ch);
    };
  }, [organizationId, load]);

  /** Una orden "primaria" por mesa (la más antigua). Suficiente para el panel POS. */
  const primaryOrderByTable = useMemo(() => {
    const m = new Map<string, OpenOrder>();
    openOrders.forEach((o) => {
      if (!o.dining_table_id) return;
      const existing = m.get(o.dining_table_id);
      if (!existing || new Date(o.opened_at) < new Date(existing.opened_at)) {
        m.set(o.dining_table_id, o);
      }
    });
    return m;
  }, [openOrders]);

  /** Todas las órdenes (sub-cuentas) por mesa, ordenadas por sub_label. Necesario para /mesas. */
  const ordersByTable = useMemo(() => {
    const m = new Map<string, OpenOrder[]>();
    openOrders.forEach((o) => {
      if (!o.dining_table_id) return;
      const arr = m.get(o.dining_table_id) ?? [];
      arr.push(o);
      m.set(o.dining_table_id, arr);
    });
    m.forEach((arr) =>
      arr.sort((a, b) => (a.sub_label ?? "").localeCompare(b.sub_label ?? "")),
    );
    return m;
  }, [openOrders]);

  return { areas, tables, openOrders, primaryOrderByTable, ordersByTable, loading, reload: load };
}
