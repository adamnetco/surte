/**
 * IEinvoiceRepository — contrato para lectura y acciones sobre facturación
 * electrónica DIAN (Innapsis) desde el POS. Extraído de los hooks
 * `useEinvoiceActions`, `useDianHealth` y `useEinvoiceResolutionStatus`.
 */

export type EinvoiceResendAction = "send_email" | "send_whatsapp" | "retry_now";

export interface ResendPayload {
  invoiceId: string;
  action: EinvoiceResendAction;
  to?: string;
}

export interface EinvoiceConfigRow {
  is_active: boolean | null;
  resolution_number: string | null;
  resolution_prefix: string | null;
  resolution_from: number | null;
  resolution_to: number | null;
  resolution_current: number | null;
  environment: string | null;
  dian_health_status: string | null;
  contingency_range: Record<string, unknown> | null;
}

export type EinvoiceConfigPatch = Partial<EinvoiceConfigRow>;

export interface IEinvoiceRepository {
  resend(payload: ResendPayload): Promise<void>;
  loadConfig(organizationId: string, opts?: { onlyProd?: boolean }): Promise<EinvoiceConfigRow | null>;
  subscribeConfig(
    organizationId: string,
    onChange: (patch: EinvoiceConfigPatch) => void,
  ): () => void;
}
