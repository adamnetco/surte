import { useCallback, useEffect, useState } from "react";
import { ALL_POS_MODES, type PosMode } from "@/modules/pos/lib/posModes";
import { supabasePosModesRepository } from "@/infrastructure/database/SupabasePosModesRepository";

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
    const row = await supabasePosModesRepository.load(organizationId);
    if (row) {
      const enabled = (row.enabled?.length ? row.enabled : ALL_POS_MODES) as PosMode[];
      const def = enabled.includes(row.default) ? row.default : enabled[0] ?? "autoservicio";
      setConfig({ enabled, default: def });
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: POSModesConfig) => {
    if (!organizationId) return;
    const { error } = await supabasePosModesRepository.save(organizationId, next);
    if (error) throw error;
    setConfig(next);
  }, [organizationId]);

  return { config, loading, reload: load, save };
}
