import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Devuelve un Set con los IDs de productos de la organización que tienen
 * al menos un modifier_group activo. Se usa para decidir si abrir el
 * sheet de modificadores al añadirlos al ticket en POS.
 */
export function useProductsWithModifiers(organizationId: string | null) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!organizationId) return;
    let cancel = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("modifier_groups")
        .select("product_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true);
      if (cancel || error || !data) return;
      setIds(new Set<string>(data.map((r: any) => r.product_id).filter(Boolean)));
    })();

    const ch = (supabase as any)
      .channel(`mods-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "modifier_groups", filter: `organization_id=eq.${organizationId}` },
        async () => {
          const { data } = await (supabase as any)
            .from("modifier_groups")
            .select("product_id")
            .eq("organization_id", organizationId)
            .eq("is_active", true);
          if (!cancel && data) setIds(new Set<string>(data.map((r: any) => r.product_id).filter(Boolean)));
        },
      )
      .subscribe();
    return () => {
      cancel = true;
      (supabase as any).removeChannel(ch);
    };
  }, [organizationId]);

  return ids;
}
