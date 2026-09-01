// Adaptador local del catálogo (Dexie/IndexedDB, particionado por tenant).
// En Desktop este adaptador se reemplaza por SQLite cifrado sin tocar la UI.
import type {
  ILocalCatalogRepository, LocalCatalogCategory, LocalCatalogProduct,
} from "@/core/ports/ILocalCatalogRepository";
import {
  getCachedProducts, getCachedCategories, refreshCatalogCache,
} from "@/modules/offline/lib/catalog";

export const dexieCatalogRepository: ILocalCatalogRepository = {
  async listProducts(organizationId: string): Promise<LocalCatalogProduct[]> {
    return (await getCachedProducts(organizationId)) as LocalCatalogProduct[];
  },
  async listCategories(organizationId: string): Promise<LocalCatalogCategory[]> {
    const rows = await getCachedCategories(organizationId);
    return rows.map((c: any) => ({
      id: c.id, name: c.name, icon_name: c.icon_name ?? null, sort_order: c.sort_order ?? 0,
    }));
  },
  async sync(organizationId: string, force = false) {
    return refreshCatalogCache(organizationId, force);
  },
};
