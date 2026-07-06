/**
 * SupabaseCouponRepository — implementa `ICouponRepository` con RPC
 * `redeem_coupon` de Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ICouponRepository } from "@/core/ports/ICouponRepository";

const asError = (raw: unknown): Error | null =>
  raw ? new Error((raw as { message?: string }).message ?? "coupon_redeem_failed") : null;

export const supabaseCouponRepository: ICouponRepository = {
  async redeem(couponId: string) {
    const { error } = await supabase.rpc("redeem_coupon", { _coupon_id: couponId });
    return { error: asError(error) };
  },
};
