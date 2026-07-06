/**
 * SupabasePosVoidRepository — adaptador Supabase para IPosVoidRepository.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IPosVoidRepository,
  VoidTableItemResult,
} from "@/core/ports/IPosVoidRepository";

const asAny = supabase as any;

export const supabasePosVoidRepository: IPosVoidRepository = {
  async voidTableItem({ itemId, reasonCode, reasonText }): Promise<VoidTableItemResult> {
    const { data, error } = await asAny.rpc("pos_void_table_item", {
      _item_id: itemId,
      _reason_code: reasonCode,
      _reason_text: reasonText,
    });
    if (error) throw error;
    return {
      ticket: (data as any)?.ticket ?? null,
      fiscal_hash: (data as any)?.fiscal_hash ?? null,
    };
  },
};
