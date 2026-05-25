import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_POS_MODES, type PosMode } from "@/lib/posModes";

export interface POSModesConfig {
  enabled: PosMode[];
  default: PosMode;
}

const FALLBACK: POSModesConfig = { enabled: ALL_POS_MODES, default: "autoservicio" };

/** Lee la configuración de modos POS de la organización actual. */
export function usePOSModes(organizationId: string | undefined) {
  const [config, setConfig] = useState<POSModesConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("pos_enabled_modes, pos_default_mode")
      .eq("id", organizationId)
      .maybeSingle();
    if (!error && data) {
      const enabled = ((data as any).pos_enabled_modes ?? ALL_POS_MODES) as PosMode[];
      const def = ((data as any).pos_default_mode ?? "autoservicio") as PosMode;
      setConfig({
        enabled: enabled.length ? enabled : ALL_POS_MODES,
        default: enabled.includes(def) ? def : enabled[0] ?? "autoservicio",
      });
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: POSModesConfig) => {
    if (!organizationId) return;
    const { error } = await supabase
      .from("organizations")
      .update({
        pos_enabled_modes: next.enabled,
        pos_default_mode: next.default,
      } as any)
      .eq("id", organizationId);
    if (error) throw error;
    setConfig(next);
  }, [organizationId]);

  return { config, loading, reload: load, save };
}
