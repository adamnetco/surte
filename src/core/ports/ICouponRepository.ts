/**
 * ICouponRepository — contrato para redimir y consultar cupones.
 * Fase 2 · Adaptadores de Infraestructura.
 */
export interface ICouponRepository {
  /** Marca el cupón como redimido. Fire-and-forget: nunca lanza. */
  redeem(couponId: string): Promise<{ error: Error | null }>;
}
