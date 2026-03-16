import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

const TestimonialsSection = () => {
  const { data: testimonials } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("testimonials").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  if (!testimonials?.length) return null;

  return (
    <section className="px-4 py-6">
      <h2 className="text-lg font-heading font-bold text-foreground mb-4">Lo que dicen nuestros clientes</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {testimonials.map((t) => (
          <div key={t.id} className="bg-card rounded-xl p-4 min-w-[260px] max-w-[280px] shrink-0" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: t.rating }).map((_, i) => (
                <Star key={i} size={14} className="text-yellow-500 fill-yellow-500" />
              ))}
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-3 line-clamp-4">"{t.content}"</p>
            <div>
              <p className="text-sm font-heading font-semibold text-foreground">{t.customer_name}</p>
              {t.customer_city && <p className="text-xs text-muted-foreground">{t.customer_city}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TestimonialsSection;
