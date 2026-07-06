/**
 * ICouponRepository — contrato para redimir y validar cupones.
 * Fase 2 · Adaptadores de Infraestructura.
 */
export interface ValidatedCoupon {
  id: string;
  code: string;
  discount_amount: number;
}

export type CouponValidationErrorCode =
  | "expired_coupon"
  | "exhausted_coupon"
  | "min_order_not_met"
  | "invalid_coupon"
  | "unknown_error";

export interface CouponValidationResult {
  coupon: ValidatedCoupon | null;
  errorCode: CouponValidationErrorCode | null;
}

export interface ICouponRepository {
  /** Valida un cupón contra el total del pedido. Nunca lanza. */
  validate(code: string, orderTotal: number): Promise<CouponValidationResult>;

  /** Marca el cupón como redimido. Fire-and-forget: nunca lanza. */
  redeem(couponId: string): Promise<{ error: Error | null }>;
}
