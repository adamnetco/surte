import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentTypeOption {
  id: string;
  code: string;
  label: string;
  family: string;
  dian_code: string | null;
  goes_to_dian: boolean;
  requires_customer_id: boolean;
  is_default: boolean;
}

/**
 * Devuelve los tipos de documento habilitados para la organización,
 * ordenados con el default primero. Usa el catálogo dinámico
 * (document_types + organization_document_types).
 */
export function useOrgDocumentTypes(organizationId: string | null | undefined, module: "pos" | "fx" | "ecommerce" | "admin" = "pos") {
  return useQuery({
    queryKey: ["org-document-types", organizationId, module],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DocumentTypeOption[]> => {
      const { data, error } = await supabase
        .from("organization_document_types")
        .select(`
          is_default,
          is_enabled,
          document_types!inner (
            id, code, label, family, dian_code,
            goes_to_dian, requires_customer_id,
            applies_to_modules, is_active, sort_order
          )
        `)
        .eq("organization_id", organizationId!)
        .eq("is_enabled", true);

      if (error) throw error;

      return (data ?? [])
        .filter((row: any) => row.document_types?.is_active && row.document_types?.applies_to_modules?.includes(module))
        .map((row: any) => ({
          id: row.document_types.id,
          code: row.document_types.code,
          label: row.document_types.label,
          family: row.document_types.family,
          dian_code: row.document_types.dian_code,
          goes_to_dian: row.document_types.goes_to_dian,
          requires_customer_id: row.document_types.requires_customer_id,
          is_default: row.is_default,
        }))
        .sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return a.label.localeCompare(b.label, "es");
        });
    },
  });
}
