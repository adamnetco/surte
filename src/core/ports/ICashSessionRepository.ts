/**
 * ICashSessionRepository — contrato para el cierre Z de caja:
 * snapshot de totales/denominaciones, foto de arqueo y cierre atómico.
 * Fase 2 · Adaptadores de Infraestructura (dominio POS · caja).
 */
export interface CashSessionTotals {
  cash: number;
  card: number;
  transfer: number;
  other: number;
  total: number;
  count: number;
  tips: number;
}

export interface CashDenomination {
  id: string;
  value: number;
  kind: string;
}

export interface CashSessionCloseSnapshot {
  totals: CashSessionTotals;
  denominations: CashDenomination[];
}

export interface DenominationCount {
  denomination_id: string;
  quantity: number;
}

export interface CashSessionCloseInput {
  organizationId: string;
  sessionId: string;
  userId: string;
  expectedAmount: number;
  totals: CashSessionTotals;
  denominationCounts: DenominationCount[];
  notes: string;
  blindMode: boolean;
  arqueoPhotoPath: string | null;
}

export interface CashSessionCloseResult {
  sealSequence: number | null;
  sealHash: string | null;
}

export interface CashSessionOpenInput {
  organizationId: string;
  locationId: string;
  cashRegisterId: string;
  userId: string;
  openingAmount: number;
}

export interface OpenedCashSession {
  id: string;
  organization_id: string;
  location_id: string;
  cash_register_id: string;
  status: string;
  opening_amount: number;
  expected_amount: number;
  [k: string]: unknown;
}


export interface ICashSessionRepository {
  loadCloseSnapshot(input: {
    organizationId: string;
    sessionId: string;
  }): Promise<CashSessionCloseSnapshot>;

  uploadArqueoPhoto(input: {
    organizationId: string;
    sessionId: string;
    file: File;
  }): Promise<string>;

  /**
   * Cierra la caja de forma atómica: actualiza cash_sessions con los
   * totales/foto/notas, ejecuta el RPC de cierre, calcula el hash
   * determinístico y devuelve el sello fiscal emitido por el trigger.
   * Lanza si algo falla — la UI debe capturar con try/catch.
   */
  close(input: CashSessionCloseInput): Promise<CashSessionCloseResult>;

  /** Abre una nueva sesión de caja (turno). */
  open(input: CashSessionOpenInput): Promise<OpenedCashSession>;
}

