/**
 * Puerto de catálogo local-first.
 *
 * El POS lee SIEMPRE del plano operativo local (Dexie hoy, SQLite cifrado en
 * Desktop). La sincronización remota es un detalle del adaptador, nunca de la
 * vista. Todas las operaciones son namespaced por `organization_id`.
 */
export interface LocalCatalogProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number;
  category_id?: string | null;
  sku?: string | null;
  gtin?: string | null;
  updated_at?: string;
  organization_id?: string;
}

export interface LocalCatalogCategory {
  id: string;
  name: string;
  icon_name?: string | null;
  sort_order?: number;
}

export interface ILocalCatalogRepository {
  /** Productos activos del tenant desde la base local. */
  listProducts(organizationId: string): Promise<LocalCatalogProduct[]>;
  /** Categorías del tenant desde la base local. */
  listCategories(organizationId: string): Promise<LocalCatalogCategory[]>;
  /**
   * Refresca el snapshot local desde el plano de control.
   * Debe ser no-bloqueante para la venta: si falla, el POS sigue operando.
   */
  sync(organizationId: string, force?: boolean): Promise<{ cached: number; skipped: boolean }>;
}
