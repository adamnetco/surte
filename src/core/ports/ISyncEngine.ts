/**
 * ISyncEngine — contrato del motor de sincronización local-first por tenant.
 *
 * El plano operativo (base local) es la fuente de verdad para vender; este
 * puerto define cómo se empuja (outbox) y cómo se trae (pull incremental con
 * checkpoints) sin acoplar la UI a Supabase ni a Dexie/SQLite.
 */

export type SyncEntity = "products" | "categories";

export interface SyncCheckpoint {
  /** `${entity}:${organization_id}` */
  key: string;
  entity: SyncEntity;
  organization_id: string;
  /** Cursor remoto: mayor `updated_at` aplicado localmente (ISO). */
  cursor: string | null;
  last_pull_at: number;
  rows_applied: number;
}

export type ConflictKind =
  | "outbox_gave_up"
  | "remote_newer"
  | "duplicate_close";

export interface SyncConflict {
  id?: number;
  organization_id: string;
  kind: ConflictKind;
  entity: string;
  entity_id: string | null;
  detail: string;
  created_at: number;
  resolved_at?: number | null;
}

export interface PullResult {
  applied: number;
  removed: number;
  skipped: boolean;
}

export interface SyncRunResult {
  pushed: number;
  pushFailed: number;
  pulled: number;
  removed: number;
  conflicts: number;
  offline: boolean;
}

/** Preparación para operar sin red (Fase 9). */
export interface OfflineReadiness {
  ready: boolean;
  products: number;
  categories: number;
  pendingOutbox: number;
  lastCatalogSyncAt: number | null;
  reason?: string;
}

export interface ISyncEngine {
  run(organizationId: string): Promise<SyncRunResult>;
  pull(organizationId: string): Promise<PullResult>;
  listConflicts(organizationId: string): Promise<SyncConflict[]>;
  resolveConflict(id: number): Promise<void>;
  readiness(organizationId: string): Promise<OfflineReadiness>;
  checkpoints(organizationId: string): Promise<SyncCheckpoint[]>;
}
