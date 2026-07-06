/**
 * SupabaseShippingRepository — implementa `IShippingRepository` con las
 * tablas `shipping_zones` y `municipality_settings`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IShippingRepository,
  MunicipalityShippingConfig,
  ShippingZone,
} from "@/core/ports/IShippingRepository";

export const supabaseShippingRepository: IShippingRepository = {
  async listZones(organizationId): Promise<ShippingZone[]> {
    let q: any = supabase
      .from("shipping_zones")
      .select("*")
      .eq("is_active", true)
      .order("city")
      .order("neighborhood");
    if (organizationId) q = q.eq("organization_id", organizationId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ShippingZone[];
  },

  async listMunicipalityConfigs(): Promise<MunicipalityShippingConfig[]> {
    const { data, error } = await supabase
      .from("municipality_settings")
      .select("city, free_shipping_enabled, free_shipping_threshold")
      .eq("is_active", true);
    if (error) throw error;
    return (data ?? []) as MunicipalityShippingConfig[];
  },
};
