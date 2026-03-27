import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const GallerySection = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data: gallery } = useQuery({
    queryKey: ["gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery").select("*").eq("is_active", true).order("sort_order").limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (!gallery?.length) return null;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 py-6"
      >
        <h2 className="text-lg font-heading font-bold text-foreground mb-4">Galería</h2>
        <div className="grid grid-cols-3 gap-2">
          {gallery.map((g, i) => (
            <motion.button
              key={g.id}
              type="button"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`rounded-xl overflow-hidden bg-muted ${i === 0 ? "col-span-2 row-span-2" : "aspect-square"}`}
              onClick={() => setActiveIndex(i)}
            >
              <img src={g.image_url} alt={g.caption || "Galería SURTÉ YA"} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
            </motion.button>
          ))}
        </div>
      </motion.section>

      {activeIndex !== null && (
        <div className="fixed inset-0 z-[90] bg-foreground/80 backdrop-blur-sm flex items-center justify-center px-3" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/90 text-foreground flex items-center justify-center"
            aria-label="Cerrar galería"
          >
            <X size={18} />
          </button>

          <button
            type="button"
            onClick={() => setActiveIndex((prev) => (prev === null ? 0 : (prev - 1 + gallery.length) % gallery.length))}
            className="absolute left-2 w-10 h-10 rounded-full bg-card/80 text-foreground flex items-center justify-center"
            aria-label="Imagen anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <img
            src={gallery[activeIndex].image_url}
            alt={gallery[activeIndex].caption || "Imagen ampliada"}
            className="max-w-full max-h-[80vh] rounded-xl object-contain"
          />

          <button
            type="button"
            onClick={() => setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % gallery.length))}
            className="absolute right-2 w-10 h-10 rounded-full bg-card/80 text-foreground flex items-center justify-center"
            aria-label="Siguiente imagen"
          >
            <ChevronRight size={18} />
          </button>

          <p className="absolute bottom-6 text-xs text-primary-foreground/90 bg-foreground/40 px-3 py-1.5 rounded-full">
            {gallery[activeIndex].caption || "SURTÉ YA"}
          </p>
        </div>
      )}
    </>
  );
};

export default GallerySection;
