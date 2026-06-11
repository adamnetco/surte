import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";
import { useTenantOrgId } from "@/modules/tenant/lib/useTenantSite";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const BannerCarousel = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const { data: settings } = useAppSettings();
  const tenantOrgId = useTenantOrgId();

  const { data: banners } = useQuery({
    queryKey: ["banners", tenantOrgId],
    queryFn: async () => {
      let q: any = supabase.from("banners").select("*").eq("is_active", true).order("sort_order");
      if (tenantOrgId) q = q.eq("organization_id", tenantOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!banners?.length || banners.length <= 1) return;
    const interval = setInterval(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => clearInterval(interval);
  }, [banners]);

  if (!banners?.length) return null;
  const banner = banners[current];

  // Replace dynamic placeholders in subtitle
  const resolveSubtitle = (subtitle: string | null) => {
    if (!subtitle) return null;
    const minOrder = Number(settings?.min_order_amount || 40000);
    return subtitle.replace(/\{min_order\}/gi, formatPrice(minOrder));
  };

  return (
    <section className="px-4 mt-3 max-w-7xl mx-auto">
      <div className="relative rounded-2xl overflow-hidden" style={{ background: banner.image_url ? undefined : "var(--gradient-hero)" }}>
        {banner.image_url && (
          <img src={banner.image_url} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className={`relative z-10 px-5 py-8 ${banner.image_url ? "bg-gradient-to-r from-black/60 to-transparent" : ""}`}>
          <AnimatePresence mode="wait">
            <motion.div key={banner.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <h2 className="text-xl font-heading font-extrabold text-primary-foreground leading-tight mb-2">{banner.title}</h2>
              {banner.subtitle && (
                <p className="text-primary-foreground/80 text-sm mb-4 max-w-[240px]">
                  {resolveSubtitle(banner.subtitle)}
                </p>
              )}
              {banner.cta_text && (
                <button onClick={() => navigate(banner.cta_link || "/catalogo")} className="btn-surte flex items-center gap-2 text-sm">
                  {banner.cta_text} <ArrowRight size={16} />
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-accent w-5" : "bg-primary-foreground/40"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BannerCarousel;