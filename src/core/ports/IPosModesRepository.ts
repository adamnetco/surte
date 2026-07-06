/**
 * IPosModesRepository — Contrato para leer/guardar la configuración
 * de modos de venta POS de una organización.
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */
import type { PosMode } from "@/modules/pos/lib/posModes";

export interface PosModesConfigRow {
  readonly enabled: PosMode[];
  readonly default: PosMode;
}

export interface IPosModesRepository {
  load(organizationId: string): Promise<PosModesConfigRow | null>;
  save(organizationId: string, next: PosModesConfigRow): Promise<{ error: Error | null }>;
}
