/**
 * IDocumentTypesRepository — Contrato para catálogo de tipos de documento
 * fiscal por organización + defaults DIAN (`einvoice_configs`).
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */

export type DocumentModule = "pos" | "fx" | "ecommerce" | "admin";

export interface DocumentTypeOptionRow {
  id: string;
  code: string;
  label: string;
  family: string;
  dian_code: string | null;
  goes_to_dian: boolean;
  requires_customer_id: boolean;
  is_default: boolean;
}

export interface EinvoiceDefaultsRow {
  consumerFinal: string | null;
  withNit: string | null;
  fxOperation: string | null;
}

export interface IDocumentTypesRepository {
  /** Lista los tipos de documento habilitados para una organización + módulo. */
  listOrgDocumentTypes(
    organizationId: string,
    module: DocumentModule,
  ): Promise<DocumentTypeOptionRow[]>;

  /** Devuelve los defaults DIAN configurados para la organización. */
  getEinvoiceDefaults(organizationId: string): Promise<EinvoiceDefaultsRow>;

  /**
   * Se suscribe a UPDATE en `einvoice_configs` para la organización.
   * Devuelve la función `unsubscribe`.
   */
  subscribeEinvoiceDefaultsChanges(
    organizationId: string,
    onChange: () => void,
  ): () => void;
}
