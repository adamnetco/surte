/**
 * IMessagingGateway — Contrato para envío/enlace de mensajes salientes
 * (WhatsApp, SMS futuro). El adaptador WhatsApp vive en infrastructure.
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */

export interface WhatsAppLink {
  readonly url: string;
  readonly text: string;
  readonly destination: string | null;
}

export interface IMessagingGateway {
  /** Construye un deep-link wa.me/api.whatsapp con el mensaje pre-cargado. */
  buildWhatsAppLink(input: { phone: string; message: string }): WhatsAppLink;

  /** Abre WhatsApp (sólo tiene efecto en browser). */
  openWhatsApp?(input: { phone: string; message: string }): void;
}
