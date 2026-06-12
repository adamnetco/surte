// Offline-first storage layer (Dexie / IndexedDB)
// Stores: cached catalog, outbox of pending mutations, sync metadata.
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
}

export interface CachedCategory {
  id: string;
  name: string;
  slug: string;
  icon_name?: string | null;
  sort_order?: number;
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

export interface SyncMeta {
  key: string;
  value: any;
  updated_at: number;
}

class SurteyaOfflineDB extends Dexie {
  products!: Table<CachedProduct, string>;
  categories!: Table<CachedCategory, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<SyncMeta, string>;

  constructor() {
    super("sistecpos_offline_v1");
    this.version(1).stores({
      products: "id, name, category_id, updated_at",
      categories: "id, slug, sort_order",
      outbox: "++id, status, op, created_at, client_uuid",
      meta: "key",
    });
  }
}

export const offlineDB = new SurteyaOfflineDB();

export async function setMeta(key: string, value: any) {
  await offlineDB.meta.put({ key, value, updated_at: Date.now() });
}
export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  const row = await offlineDB.meta.get(key);
  return row?.value as T | undefined;
}
