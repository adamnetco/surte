import { useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const NotificationBanner = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(() => {
    return !localStorage.getItem("surte_notif_dismissed");
  });
  const [phone, setPhone] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubscribe = async () => {
    if (!phone || phone.length < 10) { toast.error("Ingresa un número válido"); return; }
    setSaving(true);
    const formatted = phone.startsWith("57") ? phone : `57${phone}`;
    const { error } = await supabase.from("notification_subscriptions").upsert({
      phone: formatted,
      user_id: user?.id || null,
      notify_offers: true,
      notify_fresh: true,
      notify_new_products: true,
    }, { onConflict: "phone" });

    if (error) {
      toast.error("Error al suscribir");
    } else {
      toast.success("¡Suscrito! Recibirás alertas por WhatsApp");
      localStorage.setItem("surte_notif_subscribed", "true");
      setVisible(false);
    }
    setSaving(false);
  };

  const dismiss = () => {
    localStorage.setItem("surte_notif_dismissed", "true");
    setVisible(false);
  };

  if (!visible || localStorage.getItem("surte_notif_subscribed")) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mt-3"
      >
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 relative">
          <button onClick={dismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>

          {!expanded ? (
            <button onClick={() => setExpanded(true)} className="flex items-center gap-3 w-full text-left">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <Bell size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-heading font-semibold text-foreground">¿Quieres saber de ofertas y frescos?</p>
                <p className="text-xs text-muted-foreground">Recibe alertas por WhatsApp · Toca para suscribirte</p>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-accent" />
                <p className="text-sm font-heading font-semibold text-foreground">Suscríbete a alertas WhatsApp</p>
              </div>
              <p className="text-xs text-muted-foreground">Te avisamos cuando hay ofertas, productos frescos o novedades.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">+57</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="300 123 4567"
                    maxLength={10}
                    className="w-full bg-background rounded-lg pl-10 pr-3 py-2.5 text-sm border border-border focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
                <button onClick={handleSubscribe} disabled={saving}
                  className="btn-surte text-sm px-4 py-2.5 flex items-center gap-1 shrink-0">
                  <Check size={14} /> OK
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationBanner;
