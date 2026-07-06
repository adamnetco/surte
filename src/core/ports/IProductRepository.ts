/**
 * IProductRepository — contrato para leer productos desde infraestructura.
 *
 * El core y la presentación consumen este puerto; nunca conocen Supabase.
 * Fase 2/3 · Adaptadores de Infraestructura.
 */
import type { Tables } from "@/integrations/supabase/types";

export type ProductRow = Tables<"products">;

export interface IProductRepository {
  /** Retrieve products by id. Missing ids are silently omitted. */
  findByIds(ids: string[]): Promise<ProductRow[]>;
}
