import { useQuery } from "@tanstack/react-query";
import { supabaseDocumentTypesRepository } from "@/infrastructure/database/SupabaseDocumentTypesRepository";
import type {
  DocumentModule,
  DocumentTypeOptionRow,
} from "@/core/ports/IDocumentTypesRepository";

export type DocumentTypeOption = DocumentTypeOptionRow;

/**
 * Devuelve los tipos de documento habilitados para la organización,
 * ordenados con el default primero. Usa el catálogo dinámico
 * (document_types + organization_document_types) vía
 * `supabaseDocumentTypesRepository` (Fase 2 hexagonal).
 */
export function useOrgDocumentTypes(
  organizationId: string | null | undefined,
  module: DocumentModule = "pos",
) {
  return useQuery({
    queryKey: ["org-document-types", organizationId, module],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: () =>
      supabaseDocumentTypesRepository.listOrgDocumentTypes(organizationId!, module),
  });
}
