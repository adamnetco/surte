/**
 * WhatsAppGateway — Implementa `IMessagingGateway` para WhatsApp.
 * Reutiliza los helpers existentes de sanitización y opener universal.
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */
import type {
  IMessagingGateway,
  WhatsAppLink,
} from "@/core/ports/IMessagingGateway";
import {
  openWhatsApp as openImpl,
  sanitizeWhatsAppText,
  normalisePhone,
} from "@/modules/integrations/whatsapp/whatsapp";

export const whatsAppGateway: IMessagingGateway = {
  buildWhatsAppLink({ phone, message }): WhatsAppLink {
    const p = normalisePhone(phone);
    const text = sanitizeWhatsAppText(message || "");
    const encoded = encodeURIComponent(text);
    const url = p
      ? `https://api.whatsapp.com/send?phone=${p}&text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    return { url, text, destination: p || null };
  },

  openWhatsApp({ phone, message }) {
    openImpl({ phone, message });
  },
};
