/**
 * IHealthRepository — contrato para telemetría de salud del tenant:
 * snapshot unificado (edge function) + historial de transiciones
 * (`health_events`). Extraído de `useHealthSnapshot` y `useStatusTimeline`.
 */

export type HealthStatus = "ok" | "warn" | "off" | "unknown";

export interface SiteHealth {
  id: string;
  slug: string;
  name: string;
  is_published: boolean;
  last_sync_at: string | null;
  hostname: string | null;
  cf_status: string | null;
  cf_ssl_status: string | null;
  domain_verified: boolean;
  wp_configured: boolean;
  wp_host: string | null;
}

export interface HealthSnapshot {
  version: string;
  generated_at: string;
  cached?: boolean;
  core: { status: HealthStatus; latency_ms: number; checked_at: string; error?: string };
  sites: { total: number; published: number; last_sync_at: string | null; items: SiteHealth[] };
  wp: { connected: boolean; errors: string[] };
}

export interface HealthEventRow {
  created_at: string;
  status_from: string | null;
  status_to: string;
  metadata: { message?: string } | null;
}

export interface IHealthRepository {
  getSnapshot(organizationId: string): Promise<HealthSnapshot>;
  listHealthEvents(input: {
    source: string;
    organizationId: string;
    limit: number;
  }): Promise<HealthEventRow[]>;
}
