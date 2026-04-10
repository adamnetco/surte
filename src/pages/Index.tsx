import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import HeroSection from "@/components/surte/HeroSection";
import CategoryGrid from "@/components/surte/CategoryGrid";
import FeaturedProducts from "@/components/surte/FeaturedProducts";
import BannerCarousel from "@/components/surte/BannerCarousel";
import TestimonialsSection from "@/components/surte/TestimonialsSection";
import GallerySection from "@/components/surte/GallerySection";
import BrandsSection from "@/components/surte/BrandsSection";
import FloatingCart from "@/components/surte/FloatingCart";
import GoogleReviewsDisplay from "@/components/surte/GoogleReviewsDisplay";
import StoreFooter from "@/components/surte/StoreFooter";
import NotificationBanner from "@/components/surte/NotificationBanner";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Flame, Truck, Shield, Star } from "lucide-react";
import { useAppSettings } from "@/hooks/useStore";
import JsonLd, { buildLocalBusinessSchema, buildWebSiteSchema } from "@/components/seo/JsonLd";
import HeadMeta from "@/components/seo/HeadMeta";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";

const PromoSection = () => {
  const navigate = useNavigate();
  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 py-2 max-w-7xl mx-auto"
    >
      <div
        className="rounded-2xl p-5 md:p-8 relative overflow-hidden"
        style={{ background: "var(--gradient-cta)" }}
      >
        <div className="relative z-10 md:max-w-lg">
          <span className="inline-flex items-center gap-1 text-white/80 text-xs font-medium mb-2">
            <Flame size={12} /> Sabor Santandereano
          </span>
          <h3 className="text-lg md:text-2xl font-heading font-bold text-white leading-tight mb-1" style={{ textWrap: "balance" }}>
            Salsas artesanales para tu negocio
          </h3>
          <p className="text-white/70 text-sm md:text-base mb-3 max-w-[360px]">
            Tártara, piña y más. El sabor "de la calle" que tus clientes buscan.
          </p>
          <button
            onClick={() => navigate("/catalogo?cat=salsas")}
            className="bg-white text-surte-naranja font-heading font-semibold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 hover:bg-white/90 transition-colors active:scale-[0.97]"
          >
            Ver Salsas <ArrowRight size={14} />
          </button>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 md:w-48 md:h-48 rounded-full bg-white/5" />
        <div className="absolute right-8 -top-4 w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/5" />
      </div>
    </motion.section>
  );
};

const ValueStrip = () => {
  const { data: settings } = useAppSettings();

  const defaults = [
    { icon: Truck, labelKey: "trust_badge_1_label", subKey: "trust_badge_1_sub", label: "Envío Gratis", sub: "+$40.000" },
    { icon: Shield, labelKey: "trust_badge_2_label", subKey: "trust_badge_2_sub", label: "Pago Seguro", sub: "Contraentrega" },
    { icon: Star, labelKey: "trust_badge_3_label", subKey: "trust_badge_3_sub", label: "Calidad", sub: "Garantizada" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="px-4 py-3 max-w-7xl mx-auto"
    >
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {defaults.map(({ icon: Icon, labelKey, subKey, label, sub }) => (
          <div key={labelKey} className="bg-card rounded-xl p-3 md:p-4 text-center border border-border">
            <Icon size={20} className="mx-auto text-accent mb-1" />
            <p className="text-xs md:text-sm font-heading font-semibold text-foreground">{settings?.[labelKey] || label}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">{settings?.[subKey] || sub}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
};

const Index = () => {
  const { data: settings } = useAppSettings();
  const show = (key: string) => settings?.[key] !== "false";

  const s = settings || {};
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <HeadMeta
        title={s.seo_site_name || "SURTÉ YA — Soluciones Alimenticias"}
        description={s.seo_default_description || "Salsas, cárnicos y pulpas al mayor en Bucaramanga."}
        canonical="https://surteya.com"
      />
      <JsonLd data={buildLocalBusinessSchema(s)} id="local-business" />
      <JsonLd data={buildWebSiteSchema(s)} id="website" />
      <TopBar />
      <main>
        <HeroSection />
        <NotificationBanner />
        {show("show_section_banners") && <BannerCarousel />}
        <CategoryGrid />
        <ValueStrip />
        {show("show_section_featured") && <FeaturedProducts />}
        {show("show_section_promo") && <PromoSection />}
        {show("show_section_brands") && <BrandsSection />}
        {show("show_section_gallery") && <GallerySection />}
        {show("show_section_testimonials") && <TestimonialsSection />}
        <GoogleReviewsDisplay />
      </main>
      <StoreFooter />
      <FloatingCart />
      <BottomNav />
    </div>
  );
};

export default Index;
