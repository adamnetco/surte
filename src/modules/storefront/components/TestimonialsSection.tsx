import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { useTenantOrgId } from "@/modules/tenant/lib/useTenantSite";

const TestimonialsSection = () => {
  const tenantOrgId = useTenantOrgId();
  const { data: testimonials } = useQuery({
    queryKey: ["testimonials", tenantOrgId],
    queryFn: async () => {
      let q = supabase.from("testimonials").select("*").eq("is_active", true).order("sort_order");
      if (tenantOrgId) q = q.eq("organization_id", tenantOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (!testimonials?.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 py-6 max-w-7xl mx-auto"
    >
      <h2 className="text-lg font-heading font-bold text-foreground mb-4">Lo que dicen nuestros clientes</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-card rounded-xl p-4 min-w-[260px] max-w-[280px] md:max-w-none md:min-w-0 shrink-0 md:shrink relative"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <Quote size={20} className="text-accent/20 absolute top-3 right-3" />
            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: t.rating || 5 }).map((_, j) => (
                <Star key={j} size={13} className="text-surte-naranja fill-surte-naranja" />
              ))}
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-3 line-clamp-4">"{t.content}"</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-xs font-heading font-bold text-accent">
                  {t.customer_name.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm font-heading font-semibold text-foreground leading-tight">{t.customer_name}</p>
                {t.customer_city && <p className="text-[11px] text-muted-foreground">{t.customer_city}</p>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default TestimonialsSection;
