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
import NotificationBanner from "@/components/surte/NotificationBanner";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Flame, Truck, Shield, Star } from "lucide-react";

const PromoSection = () => {
  const navigate = useNavigate();
  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 py-2"
    >
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "var(--gradient-cta)" }}
      >
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1 text-white/80 text-xs font-medium mb-2">
            <Flame size={12} /> Sabor Santandereano
          </span>
          <h3 className="text-lg font-heading font-bold text-white leading-tight mb-1" style={{ textWrap: "balance" }}>
            Salsas artesanales para tu negocio
          </h3>
          <p className="text-white/70 text-sm mb-3 max-w-[260px]">
            Tártara, piña y más. El sabor "de la calle" que tus clientes buscan.
          </p>
          <button
            onClick={() => navigate("/catalogo?cat=salsas")}
            className="bg-white text-surte-naranja font-heading font-semibold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 hover:bg-white/90 transition-colors active:scale-[0.97]"
          >
            Ver Salsas <ArrowRight size={14} />
          </button>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute right-8 -top-4 w-16 h-16 rounded-full bg-white/5" />
      </div>
    </motion.section>
  );
};

/* Trust/Value strip inspired by diezequis & todorapidas */
const ValueStrip = () => (
  <motion.section
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="px-4 py-3"
  >
    <div className="grid grid-cols-3 gap-2">
      {[
        { icon: Truck, label: "Envío Gratis", sub: "+$40.000" },
        { icon: Shield, label: "Pago Seguro", sub: "Contraentrega" },
        { icon: Star, label: "Calidad", sub: "Garantizada" },
      ].map(({ icon: Icon, label, sub }) => (
        <div key={label} className="bg-card rounded-xl p-3 text-center border border-border">
          <Icon size={20} className="mx-auto text-accent mb-1" />
          <p className="text-xs font-heading font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        </div>
      ))}
    </div>
  </motion.section>
);

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main>
        <HeroSection />
        <NotificationBanner />
        <BannerCarousel />
        <CategoryGrid />
        <ValueStrip />
        <FeaturedProducts />
        <PromoSection />
        <BrandsSection />
        <GallerySection />
        <TestimonialsSection />
      </main>
      <FloatingCart />
      <BottomNav />
    </div>
  );
};

export default Index;
