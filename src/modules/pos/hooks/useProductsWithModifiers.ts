import { useEffect, useState } from "react";
import { supabaseModifierGroupsRepository } from "@/infrastructure/database/SupabaseModifierGroupsRepository";

/**
 * Devuelve un Set con los IDs de productos de la organización que tienen
 * al menos un modifier_group activo. Se usa para decidir si abrir el
 * sheet de modificadores al añadirlos al ticket en POS.
 *
 * Fase 2 hexagonal: consume `supabaseModifierGroupsRepository`.
 */
export function useProductsWithModifiers(organizationId: string | null) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!organizationId) return;
    let cancel = false;

    const reload = async () => {
      try {
        const rows = await supabaseModifierGroupsRepository.listProductIdsWithActiveGroups(
          organizationId,
        );
        if (!cancel) setIds(new Set<string>(rows));
      } catch {
        /* silenciado: el POS puede seguir sin modificadores */
      }
    };

    reload();
    const unsubscribe = supabaseModifierGroupsRepository.subscribeGroupChanges(
      organizationId,
      reload,
    );

    return () => {
      cancel = true;
      unsubscribe();
    };
  }, [organizationId]);

  return ids;
}
