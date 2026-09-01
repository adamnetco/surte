// Caché offline ampliado: tickets del turno + clientes frecuentes.
//
// Complementa `catalog.ts` (productos/categorías) para que el POS siga siendo
// operable sin red: consultar los tickets del turno actual y asignar un cliente
// ya conocido. Solo lectura/escritura local; las mutaciones siguen viajando por
// el outbox.
import { supabase } from "@/integrations/supabase/client";
import {
  offlineDB,
  setMeta,
  getMeta,
  type CachedShiftTicket,
  type CachedCustomer,
} from "./db";

/** Tickets del turno: se refrescan con frecuencia (ventas en curso). */
export const SHIFT_TICKETS_TTL_MS = 2 * 60 * 1000;
/** Clientes frecuentes: cambian poco, TTL largo. */
export const CUSTOMERS_TTL_MS = 12 * 60 * 60 * 1000;

const SHIFT_TICKETS_LIMIT = 60;
const CUSTOMERS_LIMIT = 500;

const metaKeyTickets = (sessionId: string) => `shift_tickets_last_sync:${sessionId}`;
const metaKeyCustomers = (orgId: string) => `customers_last_sync:${orgId}`;

interface RefreshResult {
  cached: number;
  skipped: boolean;
}

const isFresh = async (key: string, ttl: number) => {
  const last = (await getMeta<number>(key)) ?? 0;
  return Date.now() - last < ttl;
};

/**
 * Descarga los últimos tickets del turno actual y los deja disponibles offline.
 * No lanza si estamos sin red: devuelve lo que ya hay en caché.
 */
export async function refreshShiftTicketsCache(
  organizationId: string,
  cashSessionId: string,
  force = false,
): Promise<RefreshResult> {
  const cachedCount = await offlineDB.shiftTickets
    .where("cash_session_id")
    .equals(cashSessionId)
    .count();

  if (!force && (await isFresh(metaKeyTickets(cashSessionId), SHIFT_TICKETS_TTL_MS))) {
    return { cached: cachedCount, skipped: true };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { cached: cachedCount, skipped: true };
  }

  const { data, error } = await supabase
    .from("pos_orders")
    .select(
      "id,organization_id,cash_session_id,ticket_number,total,status,sale_mode,customer_name,created_at",
    )
    .eq("organization_id", organizationId)
    .eq("cash_session_id", cashSessionId)
    .order("created_at", { ascending: false })
    .limit(SHIFT_TICKETS_LIMIT);
  if (error) throw error;

  const rows: CachedShiftTicket[] = (data ?? []).map((r: any) => ({
    id: r.id,
    organization_id: r.organization_id,
    cash_session_id: r.cash_session_id,
    ticket_number: Number(r.ticket_number ?? 0),
    total: Number(r.total ?? 0),
    status: r.status ?? "unknown",
    sale_mode: r.sale_mode ?? null,
    customer_name: r.customer_name ?? null,
    created_at: r.created_at,
    cached_at: Date.now(),
  }));

  await offlineDB.transaction("rw", offlineDB.shiftTickets, async () => {
    const stale = await offlineDB.shiftTickets
      .where("cash_session_id")
      .equals(cashSessionId)
      .primaryKeys();
    if (stale.length) await offlineDB.shiftTickets.bulkDelete(stale);
    if (rows.length) await offlineDB.shiftTickets.bulkPut(rows);
  });

  await setMeta(metaKeyTickets(cashSessionId), Date.now());
  return { cached: rows.length, skipped: false };
}

/** Tickets cacheados del turno, del más reciente al más antiguo. */
export async function getCachedShiftTickets(cashSessionId: string): Promise<CachedShiftTicket[]> {
  const rows = await offlineDB.shiftTickets
    .where("cash_session_id")
    .equals(cashSessionId)
    .toArray();
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Total vendido según la caché local (fallback offline del widget de turno). */
export async function getCachedShiftTotals(cashSessionId: string) {
  const rows = await getCachedShiftTickets(cashSessionId);
  const paid = rows.filter((r) => r.status !== "voided");
  return {
    tickets: paid.length,
    total: paid.reduce((acc, r) => acc + r.total, 0),
    voided: rows.length - paid.length,
  };
}

/** Descarga clientes de la organización para búsqueda local sin red. */
export async function refreshCustomersCache(
  organizationId: string,
  force = false,
): Promise<RefreshResult> {
  const cachedCount = await offlineDB.customers
    .where("organization_id")
    .equals(organizationId)
    .count();

  if (!force && (await isFresh(metaKeyCustomers(organizationId), CUSTOMERS_TTL_MS))) {
    return { cached: cachedCount, skipped: true };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { cached: cachedCount, skipped: true };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,organization_id,full_name,phone,customer_code,city,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(CUSTOMERS_LIMIT);
  if (error) throw error;

  const rows: CachedCustomer[] = (data ?? []).map((r: any) => ({
    id: r.id,
    organization_id: r.organization_id,
    full_name: r.full_name ?? null,
    phone: r.phone ?? null,
    customer_code: r.customer_code ?? null,
    city: r.city ?? null,
    search_key: [r.full_name, r.phone, r.customer_code, r.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    cached_at: Date.now(),
  }));

  await offlineDB.transaction("rw", offlineDB.customers, async () => {
    const stale = await offlineDB.customers
      .where("organization_id")
      .equals(organizationId)
      .primaryKeys();
    if (stale.length) await offlineDB.customers.bulkDelete(stale);
    if (rows.length) await offlineDB.customers.bulkPut(rows);
  });

  await setMeta(metaKeyCustomers(organizationId), Date.now());
  return { cached: rows.length, skipped: false };
}

/** Búsqueda local de clientes (nombre, teléfono, código o ciudad). */
export async function searchCachedCustomers(
  organizationId: string,
  query: string,
  limit = 20,
): Promise<CachedCustomer[]> {
  const q = query.trim().toLowerCase();
  const all = await offlineDB.customers
    .where("organization_id")
    .equals(organizationId)
    .toArray();
  const filtered = q ? all.filter((c) => c.search_key.includes(q)) : all;
  return filtered
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
    .slice(0, limit);
}

/** Métricas del caché offline, para el diálogo de estado del sistema. */
export async function getOfflineCacheStats(organizationId?: string, cashSessionId?: string) {
  const [products, categories, tickets, customers] = await Promise.all([
    offlineDB.products.count(),
    offlineDB.categories.count(),
    cashSessionId
      ? offlineDB.shiftTickets.where("cash_session_id").equals(cashSessionId).count()
      : offlineDB.shiftTickets.count(),
    organizationId
      ? offlineDB.customers.where("organization_id").equals(organizationId).count()
      : offlineDB.customers.count(),
  ]);
  return { products, categories, tickets, customers };
}

/** Limpia tickets cacheados de turnos ya cerrados (housekeeping al cerrar caja). */
export async function pruneShiftTicketsCache(keepSessionId?: string) {
  const all = await offlineDB.shiftTickets.toArray();
  const drop = all
    .filter((t) => !keepSessionId || t.cash_session_id !== keepSessionId)
    .map((t) => t.id);
  if (drop.length) await offlineDB.shiftTickets.bulkDelete(drop);
  return drop.length;
}
