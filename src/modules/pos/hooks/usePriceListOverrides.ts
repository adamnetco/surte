import { useCallback, useEffect, useState } from "react";
import { supabasePriceListRepository } from "@/infrastructure/database/SupabasePriceListRepository";

/**
 * Carga el mapa productId -> precio para una lista de precios activa.
 * Si `priceListId` es null se asume "Pública" y devuelve un mapa vacío
 * (el caller usa el precio base del producto).
 *
 * Slice 6 (Fase 2 — Contextual Bar): la lista seleccionada en la
 * `POSContextualBar` debe aplicarse al añadir cada producto al ticket.
 *
 * Fase 2 hexagonal: consume `supabasePriceListRepository` en lugar
 * del cliente Supabase directo.
 */
export function usePriceListOverrides(organizationId: string, priceListId: string | null) {
  const [map, setMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!priceListId) {
      setMap(new Map());
      return;
    }
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await supabasePriceListRepository.listBasePriceOverrides(priceListId);
        if (cancel) return;
        const m = new Map<string, number>();
        for (const row of rows) m.set(row.product_id, row.price);
        setMap(m);
      } catch {
        if (!cancel) setMap(new Map());
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [organizationId, priceListId]);

  const priceFor = useCallback(
    (productId: string, basePrice: number) => map.get(productId) ?? basePrice,
    [map],
  );

  return { priceFor, hasOverrides: map.size > 0, overrideCount: map.size, loading };
}
