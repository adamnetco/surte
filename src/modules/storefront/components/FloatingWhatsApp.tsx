import { MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";
import { useState } from "react";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";

const FloatingWhatsApp = () => {
  const isStorefront = isStorefrontTenant(detectTenant());
  const { data: settings } = useAppSettings(isStorefront);
  const phone = settings?.whatsapp_number || "";
  const greeting = settings?.whatsapp_greeting || `Hola${settings?.store_name ? ` ${settings.store_name}` : ""}, necesito ayuda con mi pedido`;
  const message = encodeURIComponent(greeting);
  const [dismissed, setDismissed] = useState(false);

  if (!isStorefront || dismissed || !phone) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 200, damping: 15 }}
      className="fixed bottom-36 right-4 z-40"
    >
      <a
        href={`https://wa.me/${phone}?text=${message}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle size={26} fill="white" strokeWidth={0} />
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center shadow-sm hover:bg-destructive hover:text-white transition-colors"
        aria-label="Cerrar WhatsApp"
      >
        <X size={10} />
      </button>
    </motion.div>
  );
};

export default FloatingWhatsApp;
