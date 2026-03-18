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
    <section className="py-8 px-4">
      <div className="text-center mb-5">
        <h2 className="text-lg font-heading font-bold text-foreground">Marcas Aliadas</h2>
        <p className="text-sm text-muted-foreground mt-1">Trabajamos con los mejores proveedores</p>
      </div>

      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-6"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: Math.max(brands.length * 3, 12), repeat: Infinity, ease: "linear" }}
        >
          {duplicated.map((brand, i) => (
            <div
              key={`${brand.id}-${i}`}
              className="shrink-0 w-24 h-16 rounded-xl bg-card border border-border flex items-center justify-center transition-all hover:border-accent/40 hover:shadow-sm"
            >
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} className="w-16 h-12 object-contain" />
              ) : (
                <div className="text-center">
                  <span className="text-lg font-heading font-bold text-accent leading-none">
                    {brand.name.substring(0, 2).toUpperCase()}
                  </span>
                  <p className="text-[8px] text-muted-foreground font-medium mt-0.5 leading-none">{brand.name}</p>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BrandsSection;
