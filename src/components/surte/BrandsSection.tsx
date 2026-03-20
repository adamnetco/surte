import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BrandsSection = () => {
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
      className="py-8 px-4"
    >
      <div className="text-center mb-5">
        <h2 className="text-lg font-heading font-bold text-foreground">Marcas Aliadas</h2>
        <p className="text-sm text-muted-foreground mt-1">Trabajamos con los mejores proveedores de Santander</p>
      </div>

      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        <motion.div
          className="flex gap-5"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: Math.max(brands.length * 4, 16), repeat: Infinity, ease: "linear" }}
        >
          {duplicated.map((brand, i) => (
            <a
              key={`${brand.id}-${i}`}
              href={brand.website_url || "#"}
              target={brand.website_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="shrink-0 w-28 h-18 rounded-xl bg-card border border-border flex items-center justify-center p-3 transition-all duration-300 hover:border-accent/40 hover:-translate-y-0.5"
              style={{ boxShadow: "var(--shadow-card)" }}
              onClick={(e) => !brand.website_url && e.preventDefault()}
            >
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} className="w-20 h-12 object-contain" />
              ) : (
                <div className="text-center">
                  <span className="text-lg font-heading font-bold text-accent leading-none">
                    {brand.name.substring(0, 2).toUpperCase()}
                  </span>
                  <p className="text-[8px] text-muted-foreground font-medium mt-0.5 leading-none truncate max-w-[80px]">{brand.name}</p>
                </div>
              )}
            </a>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default BrandsSection;
