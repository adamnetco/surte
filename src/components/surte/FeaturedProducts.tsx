import { useProducts } from "@/hooks/useStore";
import ProductCard from "./ProductCard";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedSection {
  id: string;
  label: string;
  emoji: string;
  filter_type: string;
  filter_value: string | null;
  sort_order: number;
  is_active: boolean;
}

const useFeaturedSections = () =>
  useQuery({
    queryKey: ["featured_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_sections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as FeaturedSection[];
    },
  });

const applyFilter = (products: any[], section: FeaturedSection) => {
  const val = section.filter_value?.trim().toLowerCase() || "";
  switch (section.filter_type) {
    case "offers":
      return products.filter((p) => p.original_price && p.original_price > p.price);
    case "wholesale":
      return products.filter((p) => p.is_wholesale);
    case "fresh":
      return products.filter((p) => p.is_fresh);
    case "category":
      return products.filter((p) => p.categories?.slug?.toLowerCase() === val);
    case "tag":
      return products.filter((p) => {
        if (!p.tags || !Array.isArray(p.tags)) return false;
        // Match any tag that contains the filter value (more flexible)
        return p.tags.some((t: string) => {
          const tl = t.toLowerCase().trim();
          return tl === val || tl.includes(val) || val.includes(tl);
        });
      });
    case "combo":
      return products.filter((p) => p.tags?.some((t: string) => ["combo", "pack", "kit"].includes(t.toLowerCase())));
    default:
      return products;
  }
};

const FeaturedProducts = () => {
  const navigate = useNavigate();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: sections = [], isLoading: sectionsLoading } = useFeaturedSections();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const effectiveTab = activeTab || sections[0]?.id || null;
  const currentSection = sections.find((s) => s.id === effectiveTab);

  const filtered = useMemo(() => {
    if (!products || !currentSection) return [];
    return applyFilter(products, currentSection).slice(0, 12);
  }, [products, currentSection]);

  // Show filtered products, or a "no results" message — don't fallback to random products
  const displayProducts = filtered;
  const isLoading = productsLoading || sectionsLoading;

  if (isLoading) {
    return (
      <section className="px-4 py-6 max-w-7xl mx-auto">
        <div className="h-6 bg-muted animate-pulse rounded w-32 mb-4" />
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded-full shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-product">
              <div className="aspect-square bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sections.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 py-6 max-w-7xl mx-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg md:text-xl font-heading font-bold text-foreground">Destacados</h2>
        <button
          onClick={() => navigate("/catalogo")}
          className="text-sm text-accent font-medium flex items-center gap-0.5 hover:gap-1.5 transition-all active:scale-95"
        >
          Ver todo <ChevronRight size={16} />
        </button>
      </div>

      {/* Dynamic tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-0.5">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveTab(section.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1 ${
              effectiveTab === section.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <span className="text-sm leading-none">{section.emoji}</span>
            {section.label}
          </button>
        ))}
      </div>

      {/* Products grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4"
        >
          {displayProducts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductCard product={p} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {displayProducts.length === 0 && currentSection && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No hay productos con la etiqueta "{currentSection.filter_value || currentSection.label}"</p>
          <p className="text-xs mt-1">Asigna la etiqueta desde Admin → Productos</p>
        </div>
      )}
    </motion.section>
  );
};

export default FeaturedProducts;
