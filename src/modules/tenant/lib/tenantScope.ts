/**
 * tenantScope — Helpers para garantizar que cualquier query Superadmin
 * quede aislada al `organization_id` activo.
 *
 * IMPORTANTE: en supabase-js v2, `supabase.from(table)` devuelve un
 * `PostgrestQueryBuilder` que NO expone `.eq()`. Sólo el `PostgrestFilterBuilder`
 * que devuelve `.select() / .update() / .delete()` tiene `.eq()`. Por eso
 * `scopedFrom` arranca con `.select("*")` antes de aplicar el filtro de tenant.
 *
 * Uso:
 *   const { data } = await scopedFrom("products", currentOrg.id);
 *   const { data } = await scopedSelect("products", currentOrg.id, "id,name");
 */
import { supabase } from "@/integrations/supabase/client";

export function scopedFrom(table: string, orgId: string | null | undefined) {
  if (!orgId) {
    throw new Error(`scopedFrom("${table}"): organization_id requerido`);
  }
  return (supabase as any).from(table).select("*").eq("organization_id", orgId);
}

/**
 * Variante segura con selección de columnas explícita.
 */
export function scopedSelect(
  table: string,
  orgId: string | null | undefined,
  columns = "*",
) {
  if (!orgId) throw new Error(`scopedSelect("${table}"): organization_id requerido`);
  return (supabase as any).from(table).select(columns).eq("organization_id", orgId);
}

/**
 * Compone un filtro Realtime estricto por tenant.
 */
export function tenantChannelFilter(orgId: string) {
  if (!orgId) throw new Error("tenantChannelFilter: orgId requerido");
  return `organization_id=eq.${orgId}`;
}
