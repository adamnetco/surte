import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Carga el mapa productId -> precio para una lista de precios activa.
 * Si `priceListId` es null se asume "Pública" y devuelve un mapa vacío
 * (el caller usa el precio base del producto).
 *
 * Slice 6 (Fase 2 — Contextual Bar): la lista seleccionada en la
 * `POSContextualBar` debe aplicarse al añadir cada producto al ticket.
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
      const { data, error } = await (supabase as any)
        .from("price_list_items")
        .select("product_id, price, presentation_id")
        .eq("price_list_id", priceListId)
        .is("presentation_id", null); // sólo overrides de precio base
      if (cancel) return;
      if (error) {
        setMap(new Map());
      } else {
        const m = new Map<string, number>();
        for (const row of (data ?? []) as Array<{ product_id: string; price: number }>) {
          m.set(row.product_id, Number(row.price));
        }
        setMap(m);
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [organizationId, priceListId]);

  const priceFor = useCallback(
    (productId: string, basePrice: number) => map.get(productId) ?? basePrice,
    [map],
  );

  return { priceFor, hasOverrides: map.size > 0, loading };
}
