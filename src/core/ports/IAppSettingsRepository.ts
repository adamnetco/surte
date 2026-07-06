/**
 * IAppSettingsRepository — Contrato para leer/escribir configuraciones
 * clave-valor por organización (`app_settings.key → value` JSON string).
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */
export interface IAppSettingsRepository {
  /** Devuelve el string crudo almacenado en `value` (JSON serializado) o null. */
  getRaw(organizationId: string, key: string): Promise<string | null>;
  /** Persiste un valor (upsert por organization_id + key). */
  setRaw(organizationId: string, key: string, value: string): Promise<{ error: Error | null }>;
}
