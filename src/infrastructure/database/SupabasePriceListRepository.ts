/**
 * SupabasePriceListRepository — adaptador Supabase para IPriceListRepository.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IPriceListRepository,
  PriceListItemRow,
} from "@/core/ports/IPriceListRepository";

const asAny = supabase as any;

export const supabasePriceListRepository: IPriceListRepository = {
  async listBasePriceOverrides(priceListId: string): Promise<PriceListItemRow[]> {
    const { data, error } = await asAny
      .from("price_list_items")
      .select("product_id, price")
      .eq("price_list_id", priceListId)
      .is("presentation_id", null);
    if (error) throw error;
    return ((data ?? []) as Array<{ product_id: string; price: number | string }>).map(
      (row) => ({ product_id: row.product_id, price: Number(row.price) }),
    );
  },
};
