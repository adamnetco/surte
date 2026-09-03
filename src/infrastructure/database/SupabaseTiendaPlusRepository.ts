/**
 * Adaptador Supabase del puerto ITiendaPlusRepository.
 *
 * Lecturas: directas a las tablas con RLS por `organization_id` (la columna
 * `api_key` no tiene GRANT, por lo que jamás sale al navegador).
 * Escrituras y llamadas al API remoto: siempre vía la edge function
 * `tiendaplus-sync`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ITiendaPlusRepository,
  TiendaPlusChargeResult,
  TiendaPlusConnection,
  TiendaPlusFlags,
  TiendaPlusPingResult,
  TiendaPlusSyncLogEntry,
  TiendaPlusSyncResult,
} from "@/core/ports/ITiendaPlusRepository";

const FN = "tiendaplus-sync";

const CONN_COLUMNS =
  "id, organization_id, base_url, api_key_prefix, scopes, remote_company_id, company_name, " +
  "currency_code, enabled, exposed, allow_owner_manage, sync_catalog, sync_orders, sync_payments, " +
  "orders_cursor, catalog_cursor, last_ping_at, last_sync_at, last_error";

async function callFn<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body: payload });
  if (error) {
    let details = error.message;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try { details = (await ctx.text()) || details; } catch { /* keep message */ }
    }
    try {
      const parsed = JSON.parse(details);
      return { ok: false, ...parsed } as T;
    } catch {
      return { ok: false, error: details } as unknown as T;
    }
  }
  return data as T;
}

export class SupabaseTiendaPlusRepository implements ITiendaPlusRepository {
  async getConnection(organizationId: string): Promise<TiendaPlusConnection | null> {
    const { data, error } = await supabase
      .from("tiendaplus_connections" as never)
      .select(CONN_COLUMNS)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as TiendaPlusConnection) ?? null;
  }

  async listLog(organizationId: string, limit = 30): Promise<TiendaPlusSyncLogEntry[]> {
    const { data, error } = await supabase
      .from("tiendaplus_sync_log" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as TiendaPlusSyncLogEntry[]) ?? [];
  }

  saveCredentials(input: { organizationId: string; baseUrl: string; apiKey?: string }) {
    return callFn<TiendaPlusPingResult>({
      action: "save_credentials",
      organization_id: input.organizationId,
      base_url: input.baseUrl,
      api_key: input.apiKey,
    });
  }

  ping(organizationId: string) {
    return callFn<TiendaPlusPingResult>({ action: "ping", organization_id: organizationId });
  }

  setFlags(organizationId: string, flags: TiendaPlusFlags) {
    return callFn<{ ok: boolean; error?: string }>({
      action: "set_flags",
      organization_id: organizationId,
      ...flags,
    });
  }

  setExposure(organizationId: string, input: { exposed?: boolean; allow_owner_manage?: boolean }) {
    return callFn<{ ok: boolean; error?: string }>({
      action: "set_exposure",
      organization_id: organizationId,
      ...input,
    });
  }

  pushCatalog(organizationId: string, opts?: { full?: boolean }) {
    return callFn<TiendaPlusSyncResult>({
      action: "push_catalog",
      organization_id: organizationId,
      full: opts?.full === true,
    });
  }

  pullCatalog(organizationId: string) {
    return callFn<TiendaPlusSyncResult>({ action: "pull_catalog", organization_id: organizationId });
  }

  pullOrders(organizationId: string) {
    return callFn<TiendaPlusSyncResult>({ action: "pull_orders", organization_id: organizationId });
  }

  charge(input: {
    organizationId: string;
    amount: number;
    reference: string;
    description?: string;
    idempotencyKey?: string;
  }) {
    return callFn<TiendaPlusChargeResult>({
      action: "charge",
      organization_id: input.organizationId,
      amount: input.amount,
      reference: input.reference,
      description: input.description,
      idempotency_key: input.idempotencyKey ?? input.reference,
    });
  }

  chargeStatus(organizationId: string, reference: string) {
    return callFn<TiendaPlusChargeResult>({
      action: "charge_status",
      organization_id: organizationId,
      reference,
    });
  }
}

export const tiendaPlusRepository: ITiendaPlusRepository = new SupabaseTiendaPlusRepository();
