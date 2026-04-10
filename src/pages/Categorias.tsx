import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { useCategories } from "@/hooks/useStore";
import { useNavigate } from "react-router-dom";
import CategoryIcon from "@/components/surte/CategoryIcon";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";

const Categorias = () => {
  const navigate = useNavigate();
  const { data: categories, isLoading } = useCategories();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <SeoBreadcrumbs items={[{ label: "Categorías" }]} className="mb-2" />
        <h1 className="text-xl font-heading font-bold text-foreground mb-4">Categorías</h1>
        <div className="flex flex-col gap-3">
          {isLoading
            ? [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))
            : categories?.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/hub/categoria/${cat.slug}`)}
                  className="flex items-center gap-4 bg-card rounded-xl p-4 text-left transition-all hover:shadow-md"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <CategoryIcon icon={cat.icon} size={24} color={cat.color || "hsl(var(--accent))"} />
                  </div>
                  <span className="flex-1 font-heading font-semibold text-foreground">{cat.name}</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </motion.button>
              ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Categorias;
