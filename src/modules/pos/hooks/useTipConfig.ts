// Configuración de propinas leída desde app_settings (key=`pos_tip_config`).
// Defaults sanos para Colombia (10% sugerido).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TipConfig {
  enabled: boolean;
  /** Porcentajes preset, ej. [5,10,15] */
  presets: number[];
  /** Porcentaje por defecto preseleccionado */
  default_pct: number;
  /** "suggest" muestra siempre; "off" desactiva propinas */
  mode: "suggest" | "off";
}

const DEFAULT: TipConfig = {
  enabled: true,
  presets: [5, 10, 15],
  default_pct: 10,
  mode: "suggest",
};

const KEY = "pos_tip_config";

export function useTipConfig(organizationId?: string) {
  const [config, setConfig] = useState<TipConfig>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!organizationId) { setLoaded(true); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("organization_id", organizationId)
        .eq("key", KEY)
        .maybeSingle();
      if (cancel) return;
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value as string) as Partial<TipConfig>;
          setConfig({ ...DEFAULT, ...parsed });
        } catch { /* keep default */ }
      }
      setLoaded(true);
    })();
    return () => { cancel = true; };
  }, [organizationId]);

  return { config, loaded };
}
