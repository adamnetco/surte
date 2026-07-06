/**
 * SupabaseAppSettingsRepository — Adaptador Supabase para IAppSettingsRepository.
 *
 * Encapsula la tabla `app_settings` (par clave-valor por organización).
 */
import { supabase } from "@/integrations/supabase/client";
import type { IAppSettingsRepository } from "@/core/ports/IAppSettingsRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(typeof e === "string" ? e : "Unknown error");

export const supabaseAppSettingsRepository: IAppSettingsRepository = {
  async getRaw(organizationId, key) {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("organization_id", organizationId)
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    const value = (data as any).value;
    return typeof value === "string" ? value : value == null ? null : String(value);
  },

  async setRaw(organizationId, key, value) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { organization_id: organizationId, key, value } as any,
        { onConflict: "organization_id,key" },
      );
    return { error: error ? asError(error) : null };
  },
};
