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

export interface EinvoiceStatusRow {
  id: string;
  status: string;
  cufe: string | null;
  last_error: string | null;
  retry_count: number | null;
  next_retry_at: string | null;
  document_type: string | null;
}

export interface StatusCountByOrgRow {
  status: string;
}

export interface IEinvoiceRepository {
  resend(payload: ResendPayload): Promise<void>;
  loadConfig(organizationId: string, opts?: { onlyProd?: boolean }): Promise<EinvoiceConfigRow | null>;
  subscribeConfig(
    organizationId: string,
    onChange: (patch: EinvoiceConfigPatch) => void,
  ): () => void;
  loadLatestByPosOrder(posOrderId: string): Promise<EinvoiceStatusRow | null>;
  subscribeByPosOrder(
    posOrderId: string,
    onChange: (row: EinvoiceStatusRow) => void,
  ): () => void;
  listStatusesSince(organizationId: string, sinceIso: string): Promise<StatusCountByOrgRow[]>;
  subscribeByOrg(organizationId: string, onChange: () => void): () => void;
}
