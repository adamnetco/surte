// Cache catalog (products + categories) into IndexedDB for offline POS.
import { supabase } from "@/integrations/supabase/client";
import { offlineDB, setMeta, getMeta, type CachedProduct } from "./db";

const CATALOG_TTL_MS = 30 * 60 * 1000; // 30 min freshness

export async function refreshCatalogCache(force = false): Promise<{ cached: number; skipped: boolean }> {
  const lastSync = (await getMeta<number>("catalog_last_sync")) ?? 0;
  if (!force && Date.now() - lastSync < CATALOG_TTL_MS) {
    return { cached: await offlineDB.products.count(), skipped: true };
  }
  if (!navigator.onLine) return { cached: await offlineDB.products.count(), skipped: true };

  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,price,image_url,stock,category_id,sku,gtin,updated_at")
    .eq("is_active", true)
    .order("name")
    .limit(2000);
  if (error) throw error;

  const { data: cats, error: catsErr } = await supabase
    .from("categories")
    .select("id,name,slug,icon,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (catsErr) console.warn("[catalog] categories fetch error:", catsErr.message);

  // Normaliza `icon` → `icon_name` para que la UI (POSCategoryTabs) lo resuelva
  // como nombre de icono lucide. Soporta tanto kebab-case como PascalCase.
  const catsNorm = (cats ?? []).map((c: any) => ({
    id: c.id, name: c.name, slug: c.slug, sort_order: c.sort_order ?? 0,
    icon_name: c.icon ?? null,
  }));

  await offlineDB.transaction("rw", offlineDB.products, offlineDB.categories, async () => {
    await offlineDB.products.clear();
    if (products?.length) await offlineDB.products.bulkPut(products as CachedProduct[]);
    await offlineDB.categories.clear();
    if (catsNorm.length) await offlineDB.categories.bulkPut(catsNorm as any);
  });

  await setMeta("catalog_last_sync", Date.now());
  return { cached: products?.length ?? 0, skipped: false };
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
  return offlineDB.products.orderBy("name").toArray();
}

export async function getCachedCategories() {
  return offlineDB.categories.orderBy("sort_order").toArray();
}
