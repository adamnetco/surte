// Lee la config de facturación electrónica del tenant y expone un helper
// `shouldEmit(total, customer)` para decidir si una venta del POS debe encolar
// emisión a la DIAN vía Innapsis (op `einvoice_emit` del outbox).
//
// Reglas (acordadas con el negocio):
//   - Recibo POS siempre se imprime (eso lo maneja POSWorkspace).
//   - Factura electrónica solo se emite si:
//       1) Existe einvoice_configs.is_active = true para la org
//       2) El cliente tiene docNumber (no es "consumidor final" sin documento)
//       3) total >= auto_emit_threshold (configurable; default 0 = siempre)
//   - El umbral vive en einvoice_configs.extra.auto_emit_threshold para no
//     forzar una migración: 0 = emite siempre; >0 = solo cuando supera.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { POSCustomer } from "@/modules/pos/lib/posCustomer";
import { isConsumidorFinal } from "@/modules/pos/lib/posCustomer";

export interface EinvoiceAutoEmitConfig {
  isActive: boolean;
  threshold: number;
  autoEnabled: boolean;
}

export function useEinvoiceAutoEmit(organizationId: string | undefined) {
  const query = useQuery({
    queryKey: ["einvoice-auto-emit", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EinvoiceAutoEmitConfig> => {
      const { data, error } = await supabase
        .from("einvoice_configs")
        .select("is_active, extra")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      // RLS puede negar lectura a cajeros sin rol admin; tratamos como "off".
      if (error || !data) return { isActive: false, threshold: 0, autoEnabled: false };
      const extra = (data.extra ?? {}) as Record<string, unknown>;
      const threshold = Number(extra.auto_emit_threshold ?? 0) || 0;
      const autoEnabled = extra.auto_emit_enabled !== false; // default true
      return { isActive: !!data.is_active, threshold, autoEnabled };
    },
  });

  const shouldEmit = (total: number, customer: POSCustomer | null): boolean => {
    const cfg = query.data;
    if (!cfg?.isActive || !cfg.autoEnabled) return false;
    if (!customer || isConsumidorFinal(customer)) return false;
    if (!customer.docNumber || customer.docNumber.trim().length < 5) return false;
    if (cfg.threshold > 0 && total < cfg.threshold) return false;
    return true;
  };

  return { config: query.data, shouldEmit, isLoading: query.isLoading };
}
