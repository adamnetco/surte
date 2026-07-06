/**
 * SupabasePosQuickCreateRepository — adaptador Supabase para
 * IPosQuickCreateRepository.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CreatedRow,
  IPosQuickCreateRepository,
  QuickProductDraft,
  QuickSupplierDraft,
} from "@/core/ports/IPosQuickCreateRepository";

const asAny = supabase as any;

export const supabasePosQuickCreateRepository: IPosQuickCreateRepository = {
  async createProduct(draft: QuickProductDraft): Promise<CreatedRow> {
    const { data, error } = await asAny
      .from("products")
      .insert({
        name: draft.name,
        price: draft.price,
        sku: draft.sku,
        organization_id: draft.organizationId,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error) throw error;
    return { id: (data as any).id, name: (data as any).name };
  },

  async createSupplier(draft: QuickSupplierDraft): Promise<CreatedRow> {
    const { organizationId, ...rest } = draft;
    const { data, error } = await asAny
      .from("suppliers")
      .insert({ ...rest, organization_id: organizationId })
      .select("id, name")
      .single();
    if (error) throw error;
    return { id: (data as any).id, name: (data as any).name };
  },
};
