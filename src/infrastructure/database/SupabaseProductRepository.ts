/**
 * SupabaseProductRepository — implementa `IProductRepository` con Supabase.
 *
 * Encapsula el acceso a la tabla `products` para que la UI y el core
 * queden desacoplados del cliente Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IProductRepository, ProductRow } from "@/core/ports/IProductRepository";

export const supabaseProductRepository: IProductRepository = {
  async findByIds(ids: string[]): Promise<ProductRow[]> {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("id", ids);
    if (error) {
      console.warn("[SupabaseProductRepository.findByIds]", error.message);
      return [];
    }
    return (data ?? []) as ProductRow[];
  },
};
