import { useState, useEffect } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

const ADMIN_PATHS = ["/admin", "/sitios", "/pos", "/mesas", "/kds", "/facturacion", "/compras", "/inventario", "/planes", "/billing", "/licencias", "/gerente-ia", "/catalogos-base", "/onboarding"];

const CityPickerModal = () => {
  const [open, setOpen] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const { pathname } = useLocation();
  const isAdminRoute = ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipality_settings")
        .select("*")
        .eq("is_active", true)
        .order("city");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isAdminRoute) {
      setOpen(false);
      return;
    }

    const saved = localStorage.getItem("surte_city");
    if (!saved) {
      setOpen(true);
      // Show skip option after 5 seconds so user isn't stuck forever
      const skipTimer = setTimeout(() => setShowSkip(true), 5000);
      return () => clearTimeout(skipTimer);
    }
  }, [isAdminRoute]);

  const handleSelect = (city: string) => {
    localStorage.setItem("surte_city", city);
    window.dispatchEvent(new Event("surte_city_change"));
    setOpen(false);
  };

  const handleSkip = () => {
    // Default to first city
    const defaultCity = cities[0] || "Bucaramanga";
    handleSelect(defaultCity);
  };

  const cities = municipalities?.map((m) => m.city) ?? ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 600 }}
            className="bg-card rounded-2xl w-full max-w-sm overflow-hidden border border-border shadow-2xl"
          >
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <MapPin size={24} className="text-accent" />
              </div>
              <h2 className="text-lg font-heading font-bold text-foreground mb-1">¿Dónde te encuentras?</h2>
              <p className="text-xs text-muted-foreground">Selecciona tu municipio para ver precios y disponibilidad</p>
            </div>

            <div className="px-4 pb-4 space-y-1.5">
              {cities.map((city) => (
                <button
                  key={city}
                  onClick={() => handleSelect(city)}
                  className="w-full flex items-center gap-3 bg-muted hover:bg-accent/10 rounded-xl px-4 py-3 transition-colors group"
                >
                  <MapPin size={16} className="text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1 text-left">{city}</span>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              ))}
            </div>

            {/* Skip appears after 5s so user isn't permanently blocked */}
            <AnimatePresence>
              {showSkip && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="px-4 pb-4"
                >
                  <button
                    onClick={handleSkip}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    Continuar sin seleccionar →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CityPickerModal;
