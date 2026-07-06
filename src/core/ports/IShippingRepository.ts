/**
 * IShippingRepository — contrato para consultar zonas de envío y
 * configuración de envío gratis por municipio.
 * Fase 2 · Adaptadores de Infraestructura.
 */
export interface ShippingZone {
  id: string;
  city: string;
  neighborhood: string | null;
  delivery_price: number;
  organization_id?: string | null;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface MunicipalityShippingConfig {
  city: string;
  free_shipping_enabled: boolean;
  free_shipping_threshold: number | string | null;
}

export interface IShippingRepository {
  listZones(organizationId?: string | null): Promise<ShippingZone[]>;
  listMunicipalityConfigs(): Promise<MunicipalityShippingConfig[]>;
}
