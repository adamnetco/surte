import { motion } from "framer-motion";
import { ArrowRight, Truck, Shield, Clock, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden mx-4 mt-4 rounded-2xl" style={{ background: "var(--gradient-hero)" }}>
      <div className="relative z-10 px-5 py-8 md:py-12 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 bg-surte-rojo-teja/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3 border border-surte-rojo-teja/30">
            <Flame size={12} className="text-surte-orange" />
            Sabor Santandereano de Verdad
          </span>
          <h1 className="text-2xl md:text-4xl font-heading font-extrabold text-primary-foreground leading-[1.1] mb-2" style={{ textWrap: "balance" }}>
            Salsas, Cárnicos<br />y Pulpas{" "}
            <span className="text-accent">al Mayor</span>
          </h1>
          <p className="text-primary-foreground/70 text-sm md:text-base mb-5 max-w-[320px] leading-relaxed" style={{ textWrap: "pretty" }}>
            Directo de fábrica a tu negocio en Bucaramanga y área metropolitana. Sabor "de la calle" con calidad industrial.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/catalogo")}
              className="btn-teja flex items-center gap-2 text-sm px-5 py-2.5"
            >
              Ver Catálogo
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/catalogo?cat=salsas")}
              className="bg-primary-foreground/10 backdrop-blur-sm text-primary-foreground border border-primary-foreground/20 font-heading font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-primary-foreground/15 transition-colors active:scale-[0.97]"
            >
              🌶️ Salsas
            </button>
          </div>
        </motion.div>
      </div>

      {/* Decorative */}
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-accent/8" />
      <div className="absolute -right-4 bottom-4 w-28 h-28 rounded-full bg-surte-rojo-teja/8" />

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 px-5 pb-5"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { icon: Truck, text: "Envío gratis +$40K" },
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
