import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const GallerySection = () => {
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
          <motion.div
            key={g.id}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={`rounded-xl overflow-hidden bg-muted ${i === 0 ? "col-span-2 row-span-2" : "aspect-square"}`}
          >
            <img src={g.image_url} alt={g.caption || ""} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default GallerySection;
