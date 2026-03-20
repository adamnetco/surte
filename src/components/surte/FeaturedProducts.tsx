import { useProducts } from "@/hooks/useStore";
import ProductCard from "./ProductCard";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Flame, TrendingDown } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const tabs = [
  { id: "ofertas", label: "🔥 Ofertas", filter: (p: any) => p.original_price && p.original_price > p.price },
  { id: "mayorista", label: "💰 Mayorista", filter: (p: any) => p.is_wholesale },
  { id: "frescos", label: "🌿 Frescos", filter: (p: any) => p.is_fresh },
];

const FeaturedProducts = () => {
  const navigate = useNavigate();
  const { data: products, isLoading } = useProducts();
  const [activeTab, setActiveTab] = useState("ofertas");

  const currentFilter = tabs.find((t) => t.id === activeTab)?.filter || (() => true);
  const filtered = products?.filter(currentFilter).slice(0, 6) ?? [];
  const allProducts = products?.slice(0, 6) ?? [];
  const displayProducts = filtered.length > 0 ? filtered : allProducts;

  if (isLoading) {
    return (
      <section className="px-4 py-6">
        <div className="h-6 bg-muted animate-pulse rounded w-32 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 py-6"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-heading font-bold text-foreground">Destacados</h2>
        <button
          onClick={() => navigate("/catalogo")}
          className="text-sm text-accent font-medium flex items-center gap-0.5 hover:gap-1.5 transition-all active:scale-95"
        >
          Ver todo <ChevronRight size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors active:scale-[0.97] ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {displayProducts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <ProductCard product={p} />
          </motion.div>
        ))}
      </div>

      {displayProducts.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Próximamente productos en esta categoría</p>
        </div>
      )}
    </motion.section>
  );
};

export default FeaturedProducts;
