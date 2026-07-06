/**
 * IPosSessionRepository — contrato para cargar el estado inicial del POS:
 * sedes activas, cajas registradoras y sesión abierta del usuario actual.
 * Fase 2 · Adaptadores de Infraestructura.
 */
export interface PosLocation {
  id: string;
  name: string;
}

export interface PosCashRegister {
  id: string;
  name: string;
  location_id: string;
}

export interface PosSession {
  id: string;
  location_id: string;
  cash_register_id: string;
  opening_amount: number;
  opened_at: string;
  status: string;
}

export interface PosBootstrap {
  locations: PosLocation[];
  registers: PosCashRegister[];
  activeSession: PosSession | null;
}

export interface IPosSessionRepository {
  /**
   * Carga en paralelo las sedes, cajas y sesión activa del operador.
   * Nunca lanza — retorna colecciones vacías/null en caso de error.
   */
  loadBootstrap(input: {
    organizationId: string;
    userId: string;
  }): Promise<PosBootstrap>;
}
