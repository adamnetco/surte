/**
 * ITiendaPlusRepository — contrato de la integración de doble vía con
 * "Tienda Plus by SistecPOS" (tienda online externa con API pública `x-api-key`).
 *
 * El core y la presentación solo conocen este puerto: nunca Supabase ni fetch.
 * El adaptador vive en `src/infrastructure/database/SupabaseTiendaPlusRepository.ts`
 * y delega en la edge function `tiendaplus-sync` (la llave secreta nunca baja al navegador).
 */

export type TiendaPlusScope = "catalog" | "payments" | "sales";

export interface TiendaPlusConnection {
  id: string;
  organization_id: string;
  base_url: string;
  api_key_prefix: string | null;
  scopes: TiendaPlusScope[];
  remote_company_id: string | null;
  company_name: string | null;
  currency_code: string | null;
  enabled: boolean;
  /** Superadmin: la tienda quedó habilitada para integrarse. */
  exposed: boolean;
  /** Superadmin: el dueño de la tienda puede configurar la conexión. */
  allow_owner_manage: boolean;
  sync_catalog: boolean;
  sync_orders: boolean;
  sync_payments: boolean;
  orders_cursor: string | null;
  catalog_cursor: string | null;
  last_ping_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface TiendaPlusSyncLogEntry {
  id: string;
  organization_id: string;
  direction: "push" | "pull" | "payment";
  entity: string;
  status: "success" | "error" | "partial" | "unsupported";
  items: number;
  ok_count: number;
  failed_count: number;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface TiendaPlusPingResult {
  ok: boolean;
  companyName?: string | null;
  currencyCode?: string | null;
  scopes?: TiendaPlusScope[];
  gateway?: { provider: string | null; enabled: boolean; environment: string | null } | null;
  error?: string;
}

export interface TiendaPlusSyncResult {
  ok: boolean;
  /** `true` cuando Tienda Plus aún no publica ese endpoint (404/501). */
  unsupported?: boolean;
  pushed?: number;
  pulled?: number;
  failed?: number;
  error?: string;
}

export interface TiendaPlusChargeResult {
  ok: boolean;
  reference?: string;
  status?: "pendiente" | "aprobado" | "rechazado" | "cancelado" | "error";
  externalId?: string | null;
  duplicated?: boolean;
  error?: string;
}

export interface TiendaPlusFlags {
  enabled?: boolean;
  sync_catalog?: boolean;
  sync_orders?: boolean;
  sync_payments?: boolean;
}

export interface ITiendaPlusRepository {
  getConnection(organizationId: string): Promise<TiendaPlusConnection | null>;
  listLog(organizationId: string, limit?: number): Promise<TiendaPlusSyncLogEntry[]>;

  /** Guarda base_url + llave (la llave se envía una sola vez y no vuelve a leerse). */
  saveCredentials(input: {
    organizationId: string;
    baseUrl: string;
    apiKey?: string;
  }): Promise<TiendaPlusPingResult>;

  ping(organizationId: string): Promise<TiendaPlusPingResult>;
  setFlags(organizationId: string, flags: TiendaPlusFlags): Promise<{ ok: boolean; error?: string }>;

  /** Superadmin: exposición y delegación al dueño de la tienda. */
  setExposure(
    organizationId: string,
    input: { exposed?: boolean; allow_owner_manage?: boolean },
  ): Promise<{ ok: boolean; error?: string }>;

  pushCatalog(organizationId: string, opts?: { full?: boolean }): Promise<TiendaPlusSyncResult>;
  pullCatalog(organizationId: string): Promise<TiendaPlusSyncResult>;
  pullOrders(organizationId: string): Promise<TiendaPlusSyncResult>;

  charge(input: {
    organizationId: string;
    amount: number;
    reference: string;
    description?: string;
    idempotencyKey?: string;
  }): Promise<TiendaPlusChargeResult>;
  chargeStatus(organizationId: string, reference: string): Promise<TiendaPlusChargeResult>;
}
