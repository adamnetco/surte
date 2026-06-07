import { useState } from "react";
import { Bell, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_DISMISSED = "surteya_notif_dismissed";
const STORAGE_SUBSCRIBED = "surteya_notif_subscribed";

const NotificationBanner = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(STORAGE_DISMISSED) && !localStorage.getItem(STORAGE_SUBSCRIBED);
  });
  const [phone, setPhone] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Validates Colombian mobile: 10 digits starting with 3 */
  const isValidPhone = (p: string) => /^3\d{9}$/.test(p);

  const handleSubscribe = async () => {
    if (!isValidPhone(phone)) {
      toast.error("Número inválido", {
        description: "Debe ser un celular colombiano de 10 dígitos que empieza por 3.",
      });
      return;
    }

    setSaving(true);
    const formatted = `57${phone}`;

    try {
      const { error } = await supabase
        .from("notification_subscriptions")
        .upsert(
          {
            phone: formatted,
            user_id: user?.id || null,
            notify_offers: true,
            notify_fresh: true,
            notify_new_products: true,
            is_active: true,
          },
          { onConflict: "phone" }
        );

      if (error) throw error;

      // Best-effort welcome message via YCloud (non-blocking)
      try {
        await supabase.functions.invoke("send-ycloud-whatsapp", {
          body: {
            action: "send_text",
            to: formatted,
            message:
              "Bienvenido a SURTÉ YA. Te avisaremos por WhatsApp cuando tengamos ofertas, productos frescos o novedades. Para darte de baja responde STOP.",
          },
        });
      } catch (waErr) {
        console.warn("YCloud welcome failed (non-blocking):", waErr);
      }

      toast.success("¡Suscrito!", { description: "Recibirás alertas por WhatsApp." });
      localStorage.setItem(STORAGE_SUBSCRIBED, "true");
      setVisible(false);
    } catch (err: any) {
      console.error("Subscription error:", err);
      toast.error("No pudimos completar la suscripción", {
        description: err?.message || "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setSaving(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_DISMISSED, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mt-3 max-w-7xl md:mx-auto"
      >
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 relative">
          <button
            onClick={dismiss}
            aria-label="Cerrar banner de suscripción"
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
          >
            <X size={16} />
          </button>

          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-3 w-full text-left pr-6"
            >
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <Bell size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-heading font-semibold text-foreground">
                  ¿Quieres saber de ofertas y frescos?
                </p>
                <p className="text-xs text-muted-foreground">
                  Recibe alertas por WhatsApp · Toca para suscribirte
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-accent" />
                <p className="text-sm font-heading font-semibold text-foreground">
                  Suscríbete a alertas WhatsApp
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Te avisamos cuando hay ofertas, productos frescos o novedades. Sin spam.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                    +57
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="3001234567"
                    maxLength={10}
                    aria-label="Número de WhatsApp colombiano"
                    className="w-full bg-background rounded-lg pl-10 pr-3 py-2.5 text-sm border border-border focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={saving || !isValidPhone(phone)}
                  className="btn-surte text-sm px-4 py-2.5 flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Confirmar suscripción"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? "" : "OK"}
                </button>
              </div>
              {phone.length > 0 && !isValidPhone(phone) && (
                <p className="text-[11px] text-destructive">
                  Debe ser un celular de 10 dígitos que empiece por 3 (ej: 3001234567).
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationBanner;
