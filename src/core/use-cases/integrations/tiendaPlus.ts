/**
 * Casos de uso puros de la integración Tienda Plus (0% React, 0% Supabase).
 *
 * Aquí vive la lógica de mapeo y de decisión (¿puede el dueño configurar?,
 * ¿qué producto se envía?, ¿qué referencia de cobro se usa?), de modo que la UI
 * y los adaptadores queden libres de reglas de negocio.
 */
import type {
  TiendaPlusConnection,
  TiendaPlusScope,
} from "@/core/ports/ITiendaPlusRepository";

export interface CatalogProductInput {
  id: string;
  name: string;
  price: number;
  sku?: string | null;
  gtin?: string | null;
  stock?: number | null;
  is_active?: boolean | null;
  image_url?: string | null;
  updated_at?: string | null;
}

export interface TiendaPlusCatalogItem {
  externalId: string;
  name: string;
  price: number;
  sku: string | null;
  barcode: string | null;
  stock: number;
  active: boolean;
  imageUrl: string | null;
  updatedAt: string | null;
}

/** Normaliza un producto del POS al contrato de catálogo de Tienda Plus. */
export function toCatalogItem(p: CatalogProductInput): TiendaPlusCatalogItem {
  return {
    externalId: p.id,
    name: (p.name ?? "").trim(),
    price: Math.max(0, Math.round(Number(p.price ?? 0))),
    sku: p.sku?.trim() || null,
    barcode: p.gtin?.trim() || null,
    stock: Math.max(0, Math.trunc(Number(p.stock ?? 0))),
    active: p.is_active !== false,
    imageUrl: p.image_url || null,
    updatedAt: p.updated_at ?? null,
  };
}

/** Corta el lote para no exceder el límite del endpoint remoto. */
export function chunkCatalog<T>(items: T[], size = 100): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface RemoteOrderInput {
  id: string;
  number?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  total?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  items?: Array<{
    externalId?: string | null;
    sku?: string | null;
    name?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
  }>;
}

export interface MappedOrder {
  external_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  total: number;
  notes: string | null
  created_at: string | null;
  items: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

/** Mapea un pedido de la tienda online al pedido del POS. */
export function toPosOrder(order: RemoteOrderInput): MappedOrder {
  const items = (order.items ?? []).map((it) => {
    const quantity = Math.max(1, Math.trunc(Number(it.quantity ?? 1)));
    const unit = Math.max(0, Math.round(Number(it.unitPrice ?? 0)));
    return {
      product_id: it.externalId || null,
      product_name: (it.name ?? "Artículo").trim(),
      quantity,
      unit_price: unit,
      total_price: unit * quantity,
    };
  });
  const computed = items.reduce((acc, it) => acc + it.total_price, 0);
  return {
    external_id: order.id,
    order_number: (order.number || `TP-${order.id.slice(0, 8)}`).toUpperCase(),
    customer_name: (order.customerName ?? "Cliente Tienda Plus").trim(),
    customer_phone: order.customerPhone?.trim() || null,
    customer_address: order.customerAddress?.trim() || null,
    total: Math.max(0, Math.round(Number(order.total ?? computed))),
    notes: order.notes?.trim() || null,
    created_at: order.createdAt ?? null,
    items,
  };
}

/** Referencia estable e idempotente para cobros con datáfono. */
export function buildChargeReference(prefix: string, orderId: string): string {
  const clean = (prefix || "SISTEC").replace(/[^A-Z0-9-]/gi, "").toUpperCase().slice(0, 12) || "SISTEC";
  return `${clean}-${orderId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export function hasScope(conn: Pick<TiendaPlusConnection, "scopes">, scope: TiendaPlusScope): boolean {
  return (conn.scopes ?? []).includes(scope);
}

/** ¿Está lista la conexión para operar en doble vía? */
export function connectionReadiness(conn: TiendaPlusConnection | null): {
  configured: boolean;
  active: boolean;
  canPushCatalog: boolean;
  canPullOrders: boolean;
  canCharge: boolean;
  blockedReason: string | null;
} {
  if (!conn) {
    return {
      configured: false, active: false, canPushCatalog: false,
      canPullOrders: false, canCharge: false,
      blockedReason: "La tienda aún no tiene conexión con Tienda Plus.",
    };
  }
  const configured = Boolean(conn.api_key_prefix);
  const active = configured && conn.enabled && conn.exposed;
  const blockedReason = !conn.exposed
    ? "El superadmin no ha expuesto esta tienda para integrarse con Tienda Plus."
    : !configured
      ? "Falta pegar la llave x-api-key generada en Tienda Plus."
      : !conn.enabled
        ? "La integración está pausada."
        : null;
  return {
    configured,
    active,
    canPushCatalog: active && conn.sync_catalog && hasScope(conn, "catalog"),
    canPullOrders: active && conn.sync_orders && hasScope(conn, "sales"),
    canCharge: active && conn.sync_payments && hasScope(conn, "payments"),
    blockedReason,
  };
}

/** Reglas de quién puede editar la conexión (dueño de tienda vs superadmin). */
export function canManageConnection(
  conn: TiendaPlusConnection | null,
  role: "superadmin" | "admin" | "editor" | "user" | string | null,
): boolean {
  if (role === "superadmin") return true;
  if (!conn) return false;
  return conn.exposed && conn.allow_owner_manage && (role === "admin" || role === "editor");
}
