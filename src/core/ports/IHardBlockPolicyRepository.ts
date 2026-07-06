/**
 * IHardBlockPolicyRepository — contrato para la política "hard block"
 * cuando DIAN está caído (POS-einvoice-hard-block-policy).
 *
 * Encapsula:
 *  - Lectura del flag `einvoice_configs.hard_block_when_dian_down` (prod).
 *  - Suscripción realtime a cambios de dicho flag.
 *  - Registro de auditoría cuando un superadmin activa el override.
 *
 * Fase 2 · Hexagonal. Consumido por usePosCobroGate.
 */

export interface HardBlockOverrideAuditPayload {
  user_id: string | null;
  dian_health: string;
  has_contingency: boolean;
  activated_at: string;
  ttl_minutes: number;
}

export interface IHardBlockPolicyRepository {
  /** Lee el flag `hard_block_when_dian_down` del entorno prod. */
  getHardBlockFlag(organizationId: string): Promise<boolean>;

  /** Suscribe cambios del flag en tiempo real. Devuelve unsubscribe. */
  subscribeHardBlockFlag(
    organizationId: string,
    onChange: (nextValue: boolean) => void,
  ): () => void;

  /** Registra en `sync_logs` la activación de un override. */
  logOverrideActivation(
    organizationId: string,
    payload: HardBlockOverrideAuditPayload,
  ): Promise<void>;

  /** Devuelve el id del usuario autenticado (para auditoría). */
  getCurrentUserId(): Promise<string | null>;
}
