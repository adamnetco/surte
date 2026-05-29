/**
 * tenantScope — Helper para garantizar que cualquier query Superadmin
 * quede aislada al `organization_id` activo.
 *
 * Uso:
 *   const q = scopedFrom("products", currentOrg.id).select("*");
 *
 * El helper lanza si no recibe orgId, evitando queries sin scope que
 * podrían filtrar datos cruzados entre tiendas.
 */
import { supabase } from "@/integrations/supabase/client";

export function scopedFrom(table: string, orgId: string | null | undefined) {
  if (!orgId) {
    throw new Error(`scopedFrom("${table}"): organization_id requerido`);
  }
  return (supabase as any).from(table).eq("organization_id", orgId) ??
    (supabase as any).from(table);
}

/**
 * Variante segura para `.select()`. Devuelve un builder ya filtrado por org.
 */
export function scopedSelect(table: string, orgId: string | null | undefined, columns = "*") {
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
