import { motion } from "framer-motion";
import { ArrowRight, Truck, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden mx-4 mt-4 rounded-2xl" style={{ background: "var(--gradient-hero)" }}>
      <div className="relative z-10 px-5 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block bg-accent/20 text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full mb-3 backdrop-blur-sm border border-accent/30">
            🌿 Frescura Garantizada
          </span>
          <h1 className="text-2xl font-heading font-extrabold text-primary-foreground leading-tight mb-2">
            Soluciones<br />Alimenticias<br />
            <span className="text-accent">al Mayor</span>
          </h1>
          <p className="text-primary-foreground/70 text-sm mb-5 max-w-[240px]">
            Cárnicos, pulpas, agua y más para tu negocio en Bucaramanga. Precios directos de fábrica.
          </p>
          <button
            onClick={() => navigate("/catalogo")}
            className="btn-surte flex items-center gap-2 text-sm"
          >
            Ver Catálogo
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-accent/10" />
      <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-accent/5" />

      {/* Trust badges - inspired by distrimonster/diezequis */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="relative z-10 px-5 pb-5"
      >
        <div className="flex gap-2">
          {[
            { icon: Truck, text: "Envío gratis +$40K" },
            { icon: Clock, text: "24-48h entrega" },
            { icon: Shield, text: "Pago seguro" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 bg-primary-foreground/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
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
