import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import ProductCard from "@/components/surte/ProductCard";
import { products, categories } from "@/data/mockData";
import { SlidersHorizontal, ArrowUpDown } from "lucide-react";

const Catalogo = () => {
  const [searchParams] = useSearchParams();
  const catSlug = searchParams.get("cat");
  const searchQuery = searchParams.get("q")?.toLowerCase() || "";
  const [activeCategory, setActiveCategory] = useState(catSlug || "");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");

  const filtered = useMemo(() => {
    let result = products;
    if (activeCategory) {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) result = result.filter((p) => p.category_id === cat.id);
    }
    if (searchQuery) {
      result = result.filter((p) => p.name.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery));
    }
    if (sortBy === "price-asc") result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [activeCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-1">
          {activeCategory ? categories.find((c) => c.slug === activeCategory)?.name || "Catálogo" : "Catálogo"}
        </h1>
        {searchQuery && (
          <p className="text-sm text-muted-foreground mb-3">Resultados para "{searchQuery}"</p>
        )}

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-2">
          <button
            onClick={() => setActiveCategory("")}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
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

        {/* Filters row */}
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

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {filtered.length === 0 && (
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
