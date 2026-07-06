/**
 * SupabaseDocumentTypesRepository — Adaptador Supabase para
 * IDocumentTypesRepository. Encapsula `organization_document_types`,
 * `document_types` y `einvoice_configs`.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  DocumentModule,
  DocumentTypeOptionRow,
  EinvoiceDefaultsRow,
  IDocumentTypesRepository,
} from "@/core/ports/IDocumentTypesRepository";

export const supabaseDocumentTypesRepository: IDocumentTypesRepository = {
  async listOrgDocumentTypes(
    organizationId: string,
    module: DocumentModule,
  ): Promise<DocumentTypeOptionRow[]> {
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
      .eq("organization_id", organizationId)
      .eq("is_enabled", true);

    if (error) throw error;

    return (data ?? [])
      .filter(
        (row: any) =>
          row.document_types?.is_active &&
          row.document_types?.applies_to_modules?.includes(module),
      )
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

  async getEinvoiceDefaults(organizationId: string): Promise<EinvoiceDefaultsRow> {
    const { data } = await supabase
      .from("einvoice_configs")
      .select(
        "default_doc_type_consumer_final, default_doc_type_with_nit, default_doc_type_fx_operation, is_active, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = data?.[0] as any;
    return {
      consumerFinal: row?.default_doc_type_consumer_final ?? null,
      withNit: row?.default_doc_type_with_nit ?? null,
      fxOperation: row?.default_doc_type_fx_operation ?? null,
    };
  },

  subscribeEinvoiceDefaultsChanges(organizationId, onChange) {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(uniqueTopic(`einvoice-defaults-${organizationId}`))
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "einvoice_configs",
            filter: `organization_id=eq.${organizationId}`,
          },
          () => onChange(),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseDocumentTypesRepository] realtime subscribe failed", err);
    }
    return () => safeRemoveChannel(channel);
  },
};
