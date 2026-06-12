import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Truck, Shield, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const HeroSection = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  // Get selected city from localStorage
  const selectedCity = typeof window !== "undefined" ? localStorage.getItem("tenant_city") || "" : "";

  const { data: slides } = useQuery({
    queryKey: ["hero_slides", selectedCity],
    queryFn: async () => {
      let query = supabase
        .from("hero_slides")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      const { data, error } = await query;
      if (error) throw error;
      // Filter: show city-specific slides + global slides (city is null)
      return (data || []).filter(
        (s: any) => !s.city || s.city === selectedCity
      );
    },
  });

  const hasSlides = slides && slides.length > 0;

  useEffect(() => {
    if (!hasSlides || slides.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasSlides, slides?.length]);

  const go = useCallback(
    (dir: number) => {
      if (!slides?.length) return;
      setDirection(dir);
      setCurrent((c) => (c + dir + slides.length) % slides.length);
    },
    [slides?.length]
  );

  // Fallback if no slides configured
  if (!hasSlides) {
    return (
      <section className="relative overflow-hidden mx-4 mt-4 rounded-2xl max-w-7xl md:mx-auto" style={{ background: "var(--gradient-hero)" }}>
        <div className="relative z-10 px-5 py-8 md:py-12 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-2xl md:text-4xl font-heading font-extrabold text-primary-foreground leading-[1.1] mb-2">
              {settings?.hero_title_line1 || "Tu catálogo"}<br />
              <span className="text-accent">{settings?.hero_title_accent || "siempre disponible"}</span>
            </h1>
            <p className="text-primary-foreground/70 text-sm mb-5 max-w-[320px] leading-relaxed">
              {settings?.hero_subtitle || "Directo de fábrica a tu negocio."}
            </p>
            <button
              onClick={() => navigate("/catalogo")}
              className="btn-teja flex items-center gap-2 text-sm px-5 py-2.5"
            >
              Ver Catálogo <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>
      </section>
    );
  }

  const slide = slides[current];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const bgImage = (isMobile && slide.image_mobile_url) || slide.image_url;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <section className="relative overflow-hidden mx-4 mt-4 rounded-2xl max-w-7xl md:mx-auto">
      {/* Background image with lazy loading */}
      {bgImage ? (
        <img
          src={bgImage}
          alt={slide.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      )}

      {/* Overlay for readability */}
      <div className={`absolute inset-0 ${bgImage ? "bg-gradient-to-r from-black/65 via-black/40 to-transparent" : ""}`} />

      <div className="relative z-10 px-5 py-8 md:py-12 md:px-8 min-h-[200px] flex flex-col justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1
              className="text-2xl md:text-4xl font-heading font-extrabold text-primary-foreground leading-[1.1] mb-2"
              style={{ textWrap: "balance" } as any}
            >
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className="text-primary-foreground/80 text-sm md:text-base mb-5 max-w-[320px] leading-relaxed">
                {slide.subtitle}
              </p>
            )}
            {slide.cta_text && (
              <button
                onClick={() => navigate(slide.cta_link || "/catalogo")}
                className="btn-teja flex items-center gap-2 text-sm px-5 py-2.5"
              >
                {slide.cta_text} <ArrowRight size={16} />
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/30 backdrop-blur-sm flex items-center justify-center z-10 active:scale-95 transition-transform"
            aria-label="Anterior"
          >
            <ChevronLeft size={16} className="text-primary-foreground" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/30 backdrop-blur-sm flex items-center justify-center z-10 active:scale-95 transition-transform"
            aria-label="Siguiente"
          >
            <ChevronRight size={16} className="text-primary-foreground" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-accent w-5" : "bg-primary-foreground/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 px-5 pb-5"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { icon: Truck, text: "Envío gratis" },
            { icon: Clock, text: "Entrega 24-48h" },
            { icon: Shield, text: "Pago seguro" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 bg-primary-foreground/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shrink-0">
              <Icon size={12} className="text-accent shrink-0" />
              <span className="text-[10px] text-primary-foreground/80 font-medium whitespace-nowrap">{text}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
