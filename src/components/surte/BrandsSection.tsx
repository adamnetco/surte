import { motion } from "framer-motion";

const BRANDS = [
  { name: "La Unión", initials: "LU" },
  { name: "Conjuguémonos", initials: "CG" },
  { name: "Del Campo", initials: "DC" },
  { name: "FreshCo", initials: "FC" },
  { name: "AguaViva", initials: "AV" },
  { name: "SaborReal", initials: "SR" },
  { name: "PulpaFrut", initials: "PF" },
  { name: "CarnesPremium", initials: "CP" },
];

const BrandsSection = () => {
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
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          {[...BRANDS, ...BRANDS].map((brand, i) => (
            <div
              key={`${brand.name}-${i}`}
              className="shrink-0 w-24 h-16 rounded-xl bg-card border border-border flex items-center justify-center transition-all hover:border-accent/40 hover:shadow-sm"
            >
              <div className="text-center">
                <span className="text-lg font-heading font-bold text-accent leading-none">{brand.initials}</span>
                <p className="text-[8px] text-muted-foreground font-medium mt-0.5 leading-none">{brand.name}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BrandsSection;
