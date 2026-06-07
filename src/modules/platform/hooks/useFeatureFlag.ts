import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useFeatureFlag — lectura de banderas para refactor por etapas.
 *
 * Las banderas viven en la tabla `public.feature_flags`:
 *   - `key`        text (PK)        clave estable, ej. "refactor.tanstack-query"
 *   - `enabled`    boolean          encendido global
 *   - `tenant_ids` uuid[] | null    si NO es null, solo aplica a esos tenants
 *
 * Resolución:
 *   1. Si no existe la fila → defaultValue (false por defecto).
 *   2. Si `enabled = false` → false.
 *   3. Si `tenant_ids` es null/vacío y `enabled = true` → true.
 *   4. Si hay `tenantId` y está en `tenant_ids` → true; si no, false.
 *
 * Diseñado para refactors: nunca debe bloquear el render. Mientras
 * carga devuelve `defaultValue` (no `undefined`) para que el código
 * llame nuevo/viejo sin parpadeos.
 */
export function useFeatureFlag(
  key: string,
  options: { tenantId?: string | null; defaultValue?: boolean } = {},
): boolean {
  const { tenantId = null, defaultValue = false } = options;
  const [value, setValue] = useState<boolean>(defaultValue);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("enabled, tenant_ids")
        .eq("key", key)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setValue(defaultValue);
        return;
      }
      if (!data.enabled) {
        setValue(false);
        return;
      }
      const scoped = Array.isArray(data.tenant_ids) && data.tenant_ids.length > 0;
      if (!scoped) {
        setValue(true);
        return;
      }
      setValue(tenantId ? data.tenant_ids.includes(tenantId) : false);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, tenantId, defaultValue]);

  return value;
}
