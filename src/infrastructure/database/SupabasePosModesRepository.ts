/**
 * SupabasePosModesRepository — Adaptador Supabase para IPosModesRepository.
 *
 * Lee/escribe las columnas `pos_enabled_modes` y `pos_default_mode` en
 * `organizations`. Usado por `usePOSModes`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IPosModesRepository, PosModesConfigRow } from "@/core/ports/IPosModesRepository";
import type { PosMode } from "@/modules/pos/lib/posModes";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(typeof e === "string" ? e : "Unknown error");

export const supabasePosModesRepository: IPosModesRepository = {
  async load(organizationId) {
    const { data, error } = await supabase
      .from("organizations")
      .select("pos_enabled_modes, pos_default_mode")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      enabled: ((data as any).pos_enabled_modes ?? []) as PosMode[],
      default: ((data as any).pos_default_mode ?? "autoservicio") as PosMode,
    };
  },

  async save(organizationId, next) {
    const { error } = await supabase
      .from("organizations")
      .update({
        pos_enabled_modes: next.enabled,
        pos_default_mode: next.default,
      } as any)
      .eq("id", organizationId);
    return { error: error ? asError(error) : null };
  },
};
