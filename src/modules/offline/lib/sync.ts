// Motor de sincronización local-first por tenant (Fases 6–9).
//
//  • push  → outbox (idempotente por client_uuid, ver outbox.ts)
//  • pull  → incremental por `updated_at` con checkpoint por entidad + tombstones
//  • conflictos → bitácora local consultable/resoluble desde la UI
//  • readiness → si el terminal puede vender sin red
//
// Todo va SIEMPRE filtrado por organization_id: la base local ya está
// particionada por tenant, y el pull nunca pide filas de otra organización.
import { supabase } from "@/integrations/supabase/client";
import type {
  ISyncEngine, OfflineReadiness, PullResult, SyncCheckpoint,
  SyncConflict, SyncEntity, SyncRunResult, ConflictKind,
} from "@/core/ports/ISyncEngine";
import { offlineDB, getMeta, setMeta, type CachedProduct } from "./db";
import { flushOutbox, pendingCount } from "./outbox";

const PULL_PAGE = 500;
const ENTITIES: SyncEntity[] = ["products", "categories"];

const ckKey = (entity: SyncEntity, orgId: string) => `${entity}:${orgId}`;
const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

async function getCheckpoint(entity: SyncEntity, orgId: string): Promise<SyncCheckpoint> {
  const existing = await offlineDB.syncCheckpoints.get(ckKey(entity, orgId));
  return (
    existing ?? {
      key: ckKey(entity, orgId),
      entity,
      organization_id: orgId,
      cursor: null,
      last_pull_at: 0,
      rows_applied: 0,
    }
  );
}

async function putCheckpoint(cp: SyncCheckpoint) {
  await offlineDB.syncCheckpoints.put(cp);
}

/** Registra un conflicto para revisión humana (no bloquea la operación). */
export async function recordConflict(input: {
  organization_id: string;
  kind: ConflictKind;
  entity: string;
  entity_id?: string | null;
  detail: string;
}): Promise<void> {
  try {
    await offlineDB.syncConflicts.add({
      organization_id: input.organization_id,
      kind: input.kind,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      detail: input.detail.slice(0, 500),
      created_at: Date.now(),
      resolved_at: null,
    });
  } catch {
    /* la bitácora nunca debe romper la venta */
  }
}

async function pullEntity(entity: SyncEntity, orgId: string): Promise<PullResult> {
  const cp = await getCheckpoint(entity, orgId);
  const table = entity === "products" ? offlineDB.products : offlineDB.categories;
  const columns =
    entity === "products"
      ? "id,name,price,image_url,stock,category_id,sku,gtin,updated_at,organization_id,is_active"
      : "id,name,slug,icon,sort_order,updated_at,organization_id,is_active";

  let query = (supabase as any)
    .from(entity)
    .select(columns)
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: true })
    .limit(PULL_PAGE);
  if (cp.cursor) query = query.gt("updated_at", cp.cursor);

  const { data, error } = await query;
  if (error) throw new Error(`pull ${entity}: ${error.message}`);

  const rows = (data ?? []) as any[];
  if (!rows.length) {
    await putCheckpoint({ ...cp, last_pull_at: Date.now() });
    return { applied: 0, removed: 0, skipped: true };
  }

  const alive = rows.filter((r) => r.is_active !== false);
  const tombstones = rows.filter((r) => r.is_active === false).map((r) => r.id as string);

  const normalized =
    entity === "products"
      ? (alive.map((p) => ({
          id: p.id, name: p.name, price: Number(p.price ?? 0), image_url: p.image_url ?? null,
          stock: Number(p.stock ?? 0), category_id: p.category_id ?? null, sku: p.sku ?? null,
          gtin: p.gtin ?? null, updated_at: p.updated_at, organization_id: p.organization_id ?? orgId,
        })) as CachedProduct[])
      : alive.map((c) => ({
          id: c.id, name: c.name, slug: c.slug, sort_order: c.sort_order ?? 0,
          icon_name: c.icon ?? null, organization_id: c.organization_id ?? orgId,
        }));

  await offlineDB.transaction("rw", table as any, async () => {
    if (normalized.length) await (table as any).bulkPut(normalized);
    if (tombstones.length) await (table as any).bulkDelete(tombstones);
  });

  const cursor = rows.reduce<string | null>(
    (max, r) => (r.updated_at && (!max || r.updated_at > max) ? r.updated_at : max),
    cp.cursor,
  );
  await putCheckpoint({
    ...cp,
    cursor,
    last_pull_at: Date.now(),
    rows_applied: cp.rows_applied + normalized.length,
  });

  return { applied: normalized.length, removed: tombstones.length, skipped: false };
}

export const syncEngine: ISyncEngine = {
  async pull(organizationId: string): Promise<PullResult> {
    if (!organizationId || !isOnline()) return { applied: 0, removed: 0, skipped: true };
    let applied = 0;
    let removed = 0;
    for (const entity of ENTITIES) {
      try {
        const r = await pullEntity(entity, organizationId);
        applied += r.applied;
        removed += r.removed;
      } catch (e: any) {
        await recordConflict({
          organization_id: organizationId,
          kind: "remote_newer",
          entity,
          detail: String(e?.message ?? e),
        });
      }
    }
    if (applied || removed) await setMeta("catalog_last_sync", Date.now());
    return { applied, removed, skipped: applied === 0 && removed === 0 };
  },

  async run(organizationId: string): Promise<SyncRunResult> {
    if (!isOnline()) {
      return { pushed: 0, pushFailed: 0, pulled: 0, removed: 0, conflicts: 0, offline: true };
    }
    const push = await flushOutbox();
    const pulled = await this.pull(organizationId);
    const conflicts = (await this.listConflicts(organizationId)).length;
    await setMeta("last_sync_run_at", Date.now());
    return {
      pushed: push.sent,
      pushFailed: push.failed,
      pulled: pulled.applied,
      removed: pulled.removed,
      conflicts,
      offline: false,
    };
  },

  async listConflicts(organizationId: string): Promise<SyncConflict[]> {
    const rows = await offlineDB.syncConflicts
      .where("organization_id")
      .equals(organizationId)
      .toArray();
    return rows
      .filter((c) => !c.resolved_at)
      .sort((a, b) => b.created_at - a.created_at);
  },

  async resolveConflict(id: number): Promise<void> {
    await offlineDB.syncConflicts.update(id, { resolved_at: Date.now() });
  },

  async readiness(organizationId: string): Promise<OfflineReadiness> {
    const [products, categories, pending, lastSync] = await Promise.all([
      offlineDB.products.count(),
      offlineDB.categories.count(),
      pendingCount(),
      getMeta<number>("catalog_last_sync"),
    ]);
    const ready = products > 0;
    return {
      ready,
      products,
      categories,
      pendingOutbox: pending,
      lastCatalogSyncAt: lastSync ?? null,
      reason: ready
        ? undefined
        : `Sin catálogo local para ${organizationId || "el tenant activo"}: conéctate una vez para descargarlo.`,
    };
  },

  async checkpoints(organizationId: string): Promise<SyncCheckpoint[]> {
    return offlineDB.syncCheckpoints.where("organization_id").equals(organizationId).toArray();
  },
};
