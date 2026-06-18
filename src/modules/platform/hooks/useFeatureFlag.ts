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
      // Uses SECURITY DEFINER RPC so the client never reads the raw
      // `tenant_ids` array (which would leak other orgs' UUIDs).
      const { data, error } = await supabase.rpc("is_feature_enabled", {
        _key: key,
        _tenant_id: tenantId ?? null,
      });

      if (cancelled) return;
      if (error || typeof data !== "boolean") {
        setValue(defaultValue);
        return;
      }
      setValue(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, tenantId, defaultValue]);

  return value;
}
