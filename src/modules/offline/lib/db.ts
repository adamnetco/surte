// Offline-first storage layer (Dexie / IndexedDB)
// Stores: cached catalog, outbox of pending mutations, sync metadata.
//
// AISLAMIENTO MULTI-TENANT: cada organización abre su PROPIA base IndexedDB
// (`sistecpos_offline_<orgId>`). Cambiar de tienda nunca mezcla catálogo,
// tickets, clientes ni outbox. La base legacy sin sufijo se mantiene como
// fallback cuando todavía no hay organización activa resuelta.
import Dexie, { Table } from "dexie";

export interface CachedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number;
  category_id?: string | null;
  sku?: string | null;
  gtin?: string | null;
  updated_at?: string;
  /** Tenant dueño de la fila (defensa extra sobre la partición por base). */
  organization_id?: string;
}

export interface CachedCategory {
  id: string;
  name: string;
  slug: string;
  icon_name?: string | null;
  sort_order?: number;
  organization_id?: string;
}

export type OutboxOp =
  | "pos_order_create"
  | "pos_payment_register"
  | "stock_movement"
  | "einvoice_emit"
  | "quote_save"
  | "park_ticket";

export interface OutboxItem {
  id?: number;
  op: OutboxOp;
  payload: any;
  created_at: number;
  attempts: number;
  last_error?: string;
  status: "pending" | "syncing" | "failed" | "done";
  organization_id: string;
  client_uuid: string; // idempotency key
}

/** Ticket del turno cacheado para consulta offline (últimos N del cierre actual). */
export interface CachedShiftTicket {
  id: string;
  organization_id: string;
  cash_session_id: string;
  ticket_number: number;
  total: number;
  status: string;
  sale_mode: string | null;
  customer_name: string | null;
  created_at: string;
  cached_at: number;
}

/** Cliente frecuente cacheado para asignar ticket sin conexión. */
export interface CachedCustomer {
  id: string;
  organization_id: string;
  full_name: string | null;
  phone: string | null;
  customer_code: string | null;
  city: string | null;
  /** Nombre + teléfono + código en minúsculas, para búsqueda local. */
  search_key: string;
  cached_at: number;
}

export interface SyncMeta {
  key: string;
  value: any;
  updated_at: number;
}

class SistecposOfflineDB extends Dexie {
  products!: Table<CachedProduct, string>;
  categories!: Table<CachedCategory, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<SyncMeta, string>;
  shiftTickets!: Table<CachedShiftTicket, string>;
  customers!: Table<CachedCustomer, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({
      products: "id, name, category_id, updated_at",
      categories: "id, slug, sort_order",
      outbox: "++id, status, op, created_at, client_uuid",
      meta: "key",
    });
    // v2 — caché offline ampliado: tickets del turno + clientes frecuentes.
    // Dexie aplica el upgrade sin borrar las tablas existentes.
    this.version(2).stores({
      shiftTickets: "id, cash_session_id, created_at, organization_id",
      customers: "id, organization_id, search_key, cached_at",
    });
  }
}

const LEGACY_DB_NAME = "sistecpos_offline_v1";
const ORG_STORAGE_KEY = "sistecpos:currentOrgId";

function readActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function dbNameFor(orgId: string | null) {
  return orgId ? `sistecpos_offline_${orgId}` : LEGACY_DB_NAME;
}

let currentOrgId: string | null = null;
let instance: SistecposOfflineDB | null = null;

function ensureInstance(): SistecposOfflineDB {
  const orgId = currentOrgId ?? readActiveOrgId();
  if (!instance || currentOrgId !== orgId) {
    if (instance) { try { instance.close(); } catch { /* noop */ } }
    currentOrgId = orgId;
    instance = new SistecposOfflineDB(dbNameFor(orgId));
  }
  return instance;
}

/**
 * Fija la organización activa del caché offline. Llamar al iniciar sesión o al
 * cambiar de tienda: cierra la base anterior y abre la del tenant indicado.
 */
export function setOfflineOrganization(orgId: string | null) {
  const next = orgId ?? readActiveOrgId();
  if (instance && currentOrgId === next) return;
  if (instance) { try { instance.close(); } catch { /* noop */ } }
  currentOrgId = next;
  instance = new SistecposOfflineDB(dbNameFor(next));
}

/** Nombre real de la base abierta (útil en diagnósticos). */
export function getOfflineDBName(): string {
  return ensureInstance().name;
}

/** Borra por completo el caché offline del tenant activo. */
export async function clearOfflineTenantData(): Promise<void> {
  const db = ensureInstance();
  await db.delete();
  instance = null;
}

/**
 * Handle estable del caché offline. Resuelve perezosamente la base del tenant
 * activo, de modo que todos los consumidores existentes siguen funcionando sin
 * cambios mientras el aislamiento se aplica por debajo.
 */
export const offlineDB = new Proxy({} as SistecposOfflineDB, {
  get(_t, prop) {
    const db = ensureInstance() as any;
    const value = db[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
  set(_t, prop, value) {
    (ensureInstance() as any)[prop] = value;
    return true;
  },
}) as SistecposOfflineDB;

export async function setMeta(key: string, value: any) {
  await offlineDB.meta.put({ key, value, updated_at: Date.now() });
}
export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  const row = await offlineDB.meta.get(key);
  return row?.value as T | undefined;
}
