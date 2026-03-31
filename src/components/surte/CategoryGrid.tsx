import { useCategories } from "@/hooks/useStore";
import { useNavigate } from "react-router-dom";
import CategoryIcon from "./CategoryIcon";
import { motion } from "framer-motion";

const CategoryGrid = () => {
  const navigate = useNavigate();
  const { data: categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <section className="px-4 py-5">
        <h2 className="text-lg font-heading font-bold text-foreground mb-3">Categorías</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 min-w-[72px]">
              <div className="w-14 h-14 rounded-2xl bg-muted animate-pulse" />
              <div className="w-12 h-3 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 py-5"
    >
      <h2 className="text-lg font-heading font-bold text-foreground mb-3">Categorías</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories?.map((cat, i) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => navigate(`/hub/categoria/${cat.slug}`)}
            className="flex flex-col items-center gap-1.5 min-w-[72px] shrink-0 group"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-active:scale-95"
              style={{ backgroundColor: `${cat.color}18` }}
            >
              <CategoryIcon icon={cat.icon} size={26} color={cat.color || "hsl(var(--accent))"} />
            </div>
            <span className="text-xs font-medium text-foreground text-center leading-tight">{cat.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
};

export default CategoryGrid;
