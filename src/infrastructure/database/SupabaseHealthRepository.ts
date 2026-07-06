/**
 * SupabaseHealthRepository — invoca la edge function `health-snapshot`
 * y consulta `health_events` para el timeline de estados.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type {
  IHealthRepository,
  HealthSnapshot,
  HealthEventRow,
} from "@/core/ports/IHealthRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const supabaseHealthRepository: IHealthRepository = {
  async getSnapshot(organizationId): Promise<HealthSnapshot> {
    const { data, error } = await supabase.functions.invoke<HealthSnapshot>(
      "health-snapshot",
      { body: { organization_id: organizationId } },
    );
    if (error) {
      logger.warn("health-snapshot failed", { organizationId, message: error.message });
      throw asError(error);
    }
    if (!data) throw new Error("health-snapshot: empty response");
    return data;
  },

  async listHealthEvents({ source, organizationId, limit }): Promise<HealthEventRow[]> {
    const { data, error } = await supabase
      .from("health_events")
      .select("created_at,status_from,status_to,metadata")
      .eq("source", source)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw asError(error);
    return (data ?? []) as unknown as HealthEventRow[];
  },
};
