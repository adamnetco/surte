// Cache catalog (products + categories) into IndexedDB for offline POS.
//
// AISLAMIENTO MULTI-TENANT: la lectura remota SIEMPRE va filtrada por
// `organization_id`. La base local ya está particionada por tenant
// (`sistecpos_offline_<orgId>`), y además cada fila cacheada guarda su
// `organization_id` para poder auditar/limpiar residuos de bases legacy.
import { supabase } from "@/integrations/supabase/client";
import { offlineDB, setMeta, getMeta, type CachedProduct } from "./db";

const CATALOG_TTL_MS = 30 * 60 * 1000; // 30 min freshness

export async function refreshCatalogCache(
  organizationId: string,
  force = false,
): Promise<{ cached: number; skipped: boolean }> {
  if (!organizationId) return { cached: await offlineDB.products.count(), skipped: true };

  const lastSync = (await getMeta<number>("catalog_last_sync")) ?? 0;
  if (!force && Date.now() - lastSync < CATALOG_TTL_MS) {
    return { cached: await offlineDB.products.count(), skipped: true };
  }
  if (!navigator.onLine) return { cached: await offlineDB.products.count(), skipped: true };

  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,price,image_url,stock,category_id,sku,gtin,updated_at,organization_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name")
    .limit(2000);
  if (error) throw error;

  const { data: cats, error: catsErr } = await supabase
    .from("categories")
    .select("id,name,slug,icon,sort_order,organization_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order");
  if (catsErr) console.warn("[catalog] categories fetch error:", catsErr.message);

  // Normaliza `icon` → `icon_name` para que la UI (POSCategoryTabs) lo resuelva
  // como nombre de icono lucide. Soporta tanto kebab-case como PascalCase.
  const catsNorm = (cats ?? []).map((c: any) => ({
    id: c.id, name: c.name, slug: c.slug, sort_order: c.sort_order ?? 0,
    icon_name: c.icon ?? null, organization_id: c.organization_id ?? organizationId,
  }));

  const productsNorm = (products ?? []).map((p: any) => ({
    ...p, organization_id: p.organization_id ?? organizationId,
  })) as CachedProduct[];

  await offlineDB.transaction("rw", offlineDB.products, offlineDB.categories, async () => {
    await offlineDB.products.clear();
    if (productsNorm.length) await offlineDB.products.bulkPut(productsNorm);
    await offlineDB.categories.clear();
    if (catsNorm.length) await offlineDB.categories.bulkPut(catsNorm as any);
  });

  await setMeta("catalog_last_sync", Date.now());
  await setMeta("catalog_organization_id", organizationId);
  return { cached: productsNorm.length, skipped: false };
}

/**
 * Catálogo local del tenant. Si se pasa `organizationId`, descarta filas de
 * otra organización que pudieran quedar en una base legacy sin partición.
 */
export async function getCachedProducts(organizationId?: string): Promise<CachedProduct[]> {
  const rows = await offlineDB.products.orderBy("name").toArray();
  if (!organizationId) return rows;
  return rows.filter((p) => !p.organization_id || p.organization_id === organizationId);
}

export async function getCachedCategories(organizationId?: string) {
  const rows = await offlineDB.categories.orderBy("sort_order").toArray();
  if (!organizationId) return rows;
  return rows.filter((c: any) => !c.organization_id || c.organization_id === organizationId);
}
