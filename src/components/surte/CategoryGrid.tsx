import { categories } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { Drumstick, Cherry, Droplets, Flame, Croissant, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Drumstick, Cherry, Droplets, Flame, Croissant,
};

const CategoryGrid = () => {
  const navigate = useNavigate();

  return (
    <section className="px-4 py-5">
      <h2 className="text-lg font-heading font-bold text-foreground mb-3">Categorías</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => {
          const Icon = iconMap[cat.icon];
          return (
            <button
              key={cat.id}
              onClick={() => navigate(`/catalogo?cat=${cat.slug}`)}
              className="flex flex-col items-center gap-1.5 min-w-[72px] shrink-0"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center bg-muted transition-transform hover:scale-105"
              >
                {Icon && <Icon size={26} className="text-accent" />}
              </div>
              <span className="text-xs font-medium text-foreground text-center leading-tight">{cat.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryGrid;
