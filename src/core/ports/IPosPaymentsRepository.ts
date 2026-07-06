/**
 * IPosPaymentsRepository — lecturas agregadas sobre `pos_payments`
 * para reportes del POS (métodos de pago por rango de fecha, etc.).
 */

export interface PosPaymentRow {
  method: string;
  amount: number;
  created_at: string;
}

export interface IPosPaymentsRepository {
  /** Lista cobros POS de la organización en el rango [fromIso, toIso]. */
  listInRange(
    organizationId: string,
    fromIso: string,
    toIso: string,
  ): Promise<PosPaymentRow[]>;
}
