import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { categories } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { Drumstick, Cherry, Droplets, Flame, Croissant, ChevronRight, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

const iconMap: Record<string, LucideIcon> = {
  Drumstick, Cherry, Droplets, Flame, Croissant,
};

const Categorias = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-4">Categorías</h1>
        <div className="flex flex-col gap-3">
          {categories.map((cat, i) => {
            const Icon = iconMap[cat.icon];
            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/catalogo?cat=${cat.slug}`)}
                className="flex items-center gap-4 bg-card rounded-xl p-4 text-left transition-all hover:shadow-md"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  {Icon && <Icon size={24} className="text-accent" />}
                </div>
                <span className="flex-1 font-heading font-semibold text-foreground">{cat.name}</span>
                <ChevronRight size={18} className="text-muted-foreground" />
              </motion.button>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Categorias;
