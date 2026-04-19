import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSwipe } from "@/context/SwipeContext";
import { Layers } from "lucide-react";

const BrandsSection = () => {
  const { open: openSwipe } = useSwipe();
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  if (!brands || brands.length === 0) return null;

  const duplicated = [...brands, ...brands];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="py-6 px-4 max-w-7xl mx-auto"
    >
      <div className="text-center mb-4">
        <h2 className="text-lg font-heading font-bold text-foreground">Marcas Aliadas</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Trabajamos con los mejores proveedores de Santander</p>
      </div>

      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        <motion.div
          className="flex gap-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: Math.max(brands.length * 4, 16), repeat: Infinity, ease: "linear" }}
        >
          {duplicated.map((brand, i) => (
            <div
              key={`${brand.id}-${i}`}
              className="relative shrink-0 w-32 h-24 rounded-xl bg-card border border-border flex items-center justify-center p-2 transition-all duration-300 hover:border-accent/40 hover:-translate-y-0.5 group"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <button
                type="button"
                onClick={() => openSwipe({ brand: brand.name })}
                className="w-full h-full flex items-center justify-center"
                aria-label={`Ver productos de ${brand.name} en modo swipe`}
              >
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" draggable={false} />
                ) : (
                  <div className="text-center">
                    <span className="text-xl font-heading font-bold text-accent leading-none">
                      {brand.name.substring(0, 2).toUpperCase()}
                    </span>
                    <p className="text-[9px] text-muted-foreground font-medium mt-0.5 leading-none truncate max-w-[100px]">{brand.name}</p>
                  </div>
                )}
              </button>
              {brand.website_url && (
                <a
                  href={brand.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Sitio web de ${brand.name}`}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shadow opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[10px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </a>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default BrandsSection;
