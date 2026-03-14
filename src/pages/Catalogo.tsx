import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import ProductCard from "@/components/surte/ProductCard";
import { useProducts, useCategories } from "@/hooks/useStore";
import { SlidersHorizontal, ArrowUpDown } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-1">
          {activeCategory ? categories?.find((c) => c.slug === activeCategory)?.name || "Catálogo" : "Catálogo"}
        </h1>
        {searchQuery && <p className="text-sm text-muted-foreground mb-3">Resultados para "{searchQuery}"</p>}

        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-2">
          <button
            onClick={() => setActiveCategory("")}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Todos
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.slug ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground">
            <SlidersHorizontal size={14} /> Filtros
          </button>
          <button
            onClick={() => setSortBy(sortBy === "price-asc" ? "price-desc" : sortBy === "price-desc" ? "default" : "price-asc")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground"
          >
            <ArrowUpDown size={14} />
            {sortBy === "price-asc" ? "Menor precio" : sortBy === "price-desc" ? "Mayor precio" : "Ordenar por"}
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
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
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-heading font-semibold mb-1">Sin resultados</p>
            <p className="text-sm">Intenta con otra búsqueda o categoría</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Catalogo;
