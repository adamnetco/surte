import { useProducts } from "@/hooks/useStore";
import ProductCard from "./ProductCard";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const FeaturedProducts = () => {
  const navigate = useNavigate();
  const { data: products, isLoading } = useProducts();
  const featured = products?.filter((p) => p.is_wholesale || p.original_price).slice(0, 4) ?? [];

  if (isLoading) {
    return (
      <section className="px-4 py-5">
        <h2 className="text-lg font-heading font-bold text-foreground mb-3">Destacados</h2>
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
      </section>
    );
  }

  if (featured.length === 0 && !isLoading) {
    return (
      <section className="px-4 py-5">
        <h2 className="text-lg font-heading font-bold text-foreground mb-3">Destacados</h2>
        <p className="text-sm text-muted-foreground">Próximamente productos destacados</p>
      </section>
    );
  }

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-heading font-bold text-foreground">Destacados</h2>
        <button
          onClick={() => navigate("/catalogo")}
          className="text-sm text-accent font-medium flex items-center gap-0.5"
        >
          Ver todo <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {featured.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
};

export default FeaturedProducts;
