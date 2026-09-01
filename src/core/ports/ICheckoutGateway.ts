/**
 * ICheckoutGateway — contrato para enviar/reenviar pedidos WhatsApp.
 *
 * El payload se mantiene "flat/legacy" (snake_case) para compatibilidad
 * con la edge function `send-whatsapp-order`. Cuando el core sea 100%
 * canónico, este contrato migrará a `CheckoutOrder` de dominio.
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */

export interface CheckoutItemPayload {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  presentation_id: string | null;
  presentation_name: string | null;
}

export interface SubmitWhatsAppOrderInput {
  items: CheckoutItemPayload[];
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string;
  notes: string;
  delivery_price: number;
  delivery_zone_id: string | null;
  preferred_delivery_date: string | null;
  preferred_time_slot: string | null;
  payment_method: string;
  geo_location: string | null;
  agent_id: string | null;
  customer_profile_id: string | null;
}

export interface SubmitWhatsAppOrderResult {
  // Legacy edge function returns order_number as number in some tenants,
  // string in others. Keep permissive until we canonicalize server-side.
  order_number?: any;
  tracking_token?: string;
  error?: string;
  [k: string]: unknown;
}

export interface ICheckoutGateway {
  /** Persist the order + enqueue WhatsApp send via edge function. */
  submitWhatsAppOrder(
    input: SubmitWhatsAppOrderInput,
  ): Promise<{ data: SubmitWhatsAppOrderResult | null; error: Error | null }>;
}
