// Hook para construir URLs de WhatsApp (wa.me) hacia el número comercial.
// Fase 2 — usa número por defecto. Fase 3 lo leerá de app_settings.
const DEFAULT_PHONE = "573001234567"; // formato sin '+'

export function useWhatsAppConfig() {
  const buildUrl = (message: string, phone: string = DEFAULT_PHONE) => {
    const clean = phone.replace(/[^\d]/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  };
  return { buildUrl, phone: DEFAULT_PHONE };
}
