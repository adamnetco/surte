import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAppSettings } from "@/hooks/useStore";

const FloatingWhatsApp = () => {
  const { data: settings } = useAppSettings();
  const phone = settings?.whatsapp_number || "573001234567";
  const message = encodeURIComponent("Hola SURTÉ, necesito ayuda con mi pedido 🛒");

  return (
    <motion.a
      href={`https://wa.me/${phone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 200, damping: 15 }}
      className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={26} fill="white" strokeWidth={0} />
    </motion.a>
  );
};

export default FloatingWhatsApp;
