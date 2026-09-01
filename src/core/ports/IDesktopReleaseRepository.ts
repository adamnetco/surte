/**
 * IDesktopReleaseRepository — contrato para consultar releases publicados
 * del cliente de escritorio (tabla `desktop_releases`).
 */
export interface DesktopRelease {
  version: string;
  platform: string;
  channel: string;
  downloadUrl: string;
  releaseNotes: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  publishedAt: string;
}

export interface IDesktopReleaseRepository {
  /**
   * Release marcado como vigente para una plataforma/canal.
   * Nunca lanza — retorna `null` si no hay release o falla la consulta.
   */
  getCurrent(input: { platform: string; channel?: string }): Promise<DesktopRelease | null>;
}
