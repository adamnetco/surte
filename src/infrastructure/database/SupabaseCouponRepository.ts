/**
 * SupabaseCouponRepository — implementa `ICouponRepository` con RPCs
 * `validate_coupon` y `redeem_coupon` de Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CouponValidationErrorCode,
  CouponValidationResult,
  ICouponRepository,
} from "@/core/ports/ICouponRepository";

const asError = (raw: unknown): Error | null =>
  raw ? new Error((raw as { message?: string }).message ?? "coupon_redeem_failed") : null;

const mapValidationError = (message: string | undefined): CouponValidationErrorCode => {
  const msg = message ?? "";
  if (msg.includes("expired_coupon")) return "expired_coupon";
  if (msg.includes("exhausted_coupon")) return "exhausted_coupon";
  if (msg.includes("min_order_not_met")) return "min_order_not_met";
  return "invalid_coupon";
};

export const supabaseCouponRepository: ICouponRepository = {
  async validate(code, orderTotal): Promise<CouponValidationResult> {
    try {
      const { data, error } = await supabase.rpc("validate_coupon", {
        _code: code.toUpperCase().trim(),
        _order_total: orderTotal,
      });
      if (error || !data || !data[0]) {
        return { coupon: null, errorCode: mapValidationError(error?.message) };
      }
      const row = data[0] as { id: string; code: string; discount_amount: number | string };
      return {
        coupon: {
          id: row.id,
          code: row.code,
          discount_amount: Number(row.discount_amount),
        },
        errorCode: null,
      };
    } catch {
      return { coupon: null, errorCode: "unknown_error" };
    }
  },

  async redeem(couponId: string) {
    const { error } = await supabase.rpc("redeem_coupon", { _coupon_id: couponId });
    return { error: asError(error) };
  },
};
