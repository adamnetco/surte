/**
 * IPosQuickCreateRepository — contrato para creaciones inline desde el POS
 * (POSQuickCreate: Cliente / Artículo / Proveedor). Cliente vive en memoria,
 * este puerto sólo cubre las escrituras persistentes.
 *
 * Fase 2 · Hexagonal.
 */

export interface QuickProductDraft {
  organizationId: string;
  name: string;
  price: number;
  sku: string | null;
}

export interface QuickSupplierDraft {
  organizationId: string;
  name: string;
  tax_id?: string;
  phone?: string;
  email?: string;
}

export interface CreatedRow {
  id: string;
  name: string;
}

export interface IPosQuickCreateRepository {
  createProduct(draft: QuickProductDraft): Promise<CreatedRow>;
  createSupplier(draft: QuickSupplierDraft): Promise<CreatedRow>;
}
