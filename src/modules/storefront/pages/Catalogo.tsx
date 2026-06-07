import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import ProductCard from "@/modules/storefront/components/ProductCard";
import VirtualizedProductGrid from "@/modules/storefront/components/VirtualizedProductGrid";
import { useProducts, useCategories } from "@/hooks/useStore";
import FloatingCart from "@/modules/storefront/components/FloatingCart";
import { ArrowUpDown, Package } from "lucide-react";
import { motion } from "framer-motion";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";

const Catalogo = () => {
  const [searchParams] = useSearchParams();
  const catSlug = searchParams.get("cat");
  const searchQuery = searchParams.get("q") || "";
  const [activeCategory, setActiveCategory] = useState(catSlug || "");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");

  const { data: categories } = useCategories();
  const { data: products, isLoading } = useProducts(activeCategory, searchQuery);

  const sorted = useMemo(() => {
    if (!products) return [];
    let result = [...products];
    if (sortBy === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, sortBy]);

  const cycleSortBy = () =>
    setSortBy(sortBy === "default" ? "price-asc" : sortBy === "price-asc" ? "price-desc" : "default");

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <SeoBreadcrumbs items={[{ label: "Catálogo", href: "/catalogo" }]} className="mb-2" />
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">
            {activeCategory
              ? categories?.find((c) => c.slug === activeCategory)?.name || "Catálogo"
              : "Catálogo"}
          </h1>
          {!isLoading && (
            <span className="text-xs text-muted-foreground font-medium">
              {sorted.length} producto{sorted.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-muted-foreground mb-3">
            Resultados para "<span className="font-medium text-foreground">{searchQuery}</span>"
          </p>
        )}

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-1">
          <button
            onClick={() => setActiveCategory("")}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors active:scale-[0.97] ${
              !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Todos
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.slug ? "" : cat.slug)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors active:scale-[0.97] ${
                activeCategory === cat.slug ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={cycleSortBy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors active:scale-[0.97] ${
              sortBy !== "default"
                ? "border-accent text-accent bg-accent/5"
                : "border-border text-muted-foreground"
            }`}
          >
            <ArrowUpDown size={14} />
            {sortBy === "price-asc" ? "Menor precio" : sortBy === "price-desc" ? "Mayor precio" : "Ordenar"}
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="card-product">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <VirtualizedProductGrid products={sorted} />
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package size={48} strokeWidth={1.2} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-heading font-semibold mb-1">Sin resultados</p>
            <p className="text-sm">Intenta con otra búsqueda o categoría</p>
          </div>
        )}
      </main>
      <FloatingCart />
      <BottomNav />
    </div>
  );
};

export default Catalogo;
