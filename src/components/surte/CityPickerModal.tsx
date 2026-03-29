import { useState, useEffect } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CityPickerModal = () => {
  const [open, setOpen] = useState(false);

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
    const saved = localStorage.getItem("surte_city");
    if (!saved) {
      // Small delay to ensure the app is fully rendered before showing modal
      const timer = setTimeout(() => setOpen(true), 300);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSelect = (city: string) => {
    localStorage.setItem("surte_city", city);
    window.dispatchEvent(new Event("surte_city_change"));
    setOpen(false);
  };

  const handleClose = () => {
    localStorage.setItem("surte_city", "Bucaramanga");
    window.dispatchEvent(new Event("surte_city_change"));
    setOpen(false);
  };

  const cities = municipalities?.map((m) => m.city) ?? [
    "Bucaramanga", "Floridablanca", "Girón", "Piedecuesta",
  ];

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
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card rounded-2xl w-full max-w-sm overflow-hidden border border-border shadow-2xl"
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <MapPin size={28} className="text-accent" />
              </div>
              <h2 className="text-lg font-heading font-bold text-foreground mb-1">
                ¿Dónde te encuentras?
              </h2>
              <p className="text-sm text-muted-foreground">
                Selecciona tu municipio para ver precios de envío y disponibilidad
              </p>
            </div>

            <div className="px-4 pb-6 space-y-2">
              {cities.map((city) => (
                <button
                  key={city}
                  onClick={() => handleSelect(city)}
                  className="w-full flex items-center gap-3 bg-muted hover:bg-accent/10 rounded-xl px-4 py-3.5 transition-colors group"
                >
                  <MapPin size={18} className="text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1 text-left">
                    {city}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CityPickerModal;
