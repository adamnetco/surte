import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseDiningFloorRepository } from "@/infrastructure/database/SupabaseDiningFloorRepository";
import type {
  DiningArea as Area,
  DiningTable as FloorTable,
  OpenTableOrder as OpenOrder,
} from "@/core/ports/IDiningFloorRepository";

/**
 * Hook compartido para vistas de salón (Mesas full-page + POS panel embebido).
 * Centraliza fetch + realtime de `dining_areas` / `dining_tables` / `table_orders`
 * y unifica el mapeo de órdenes por mesa para que ambas vistas se comporten igual.
 *
 * Este hook es UI-thin: toda la I/O vive en `SupabaseDiningFloorRepository`
 * detrás del port `IDiningFloorRepository` (Fase 2 · Hexagonal).
 */

export type { Area, FloorTable, OpenOrder };

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

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { areas: a, tables: t, openOrders: o } =
      await supabaseDiningFloorRepository.loadSnapshot({ organizationId, withCoords });
    setAreas(a);
    setTables(t);
    setOpenOrders(o);
    setLoading(false);
  }, [organizationId, withCoords]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!organizationId) return;
    const unsubscribe = supabaseDiningFloorRepository.subscribeToFloor({
      organizationId,
      onChange: () => load(),
    });
    return unsubscribe;
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
