import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

/**
 * Perfil extendido de la organización activa.
 * Lee de `organizations` las columnas añadidas en Etapa 33 (city, whatsapp_phone,
 * hero_title, primary_color, etc.). Fallbacks NEUTROS — nunca devolver
 * datos atados a SurteYa/Bucaramanga.
 */
export interface TenantProfile {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  business_type: string;
  country: string;
  region: string | null;
  city: string | null;
  timezone: string;
  currency: string;
  default_locale: string;
  whatsapp_phone: string | null;
  support_email: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  tagline: string | null;
}

export function useTenantProfile() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? null;

  return useQuery({
    queryKey: ["tenant", "profile", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TenantProfile | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select(
          [
            "id",
            "slug",
            "name",
            "legal_name",
            "tax_id",
            "business_type",
            "country",
            "region",
            "city",
            "timezone",
            "currency",
            "default_locale",
            "whatsapp_phone",
            "support_email",
            "logo_url",
            "primary_color",
            "accent_color",
            "hero_title",
            "hero_subtitle",
            "tagline",
          ].join(", ")
        )
        .eq("id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as TenantProfile) ?? null;
    },
  });
}
