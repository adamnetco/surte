import { products } from "@/data/mockData";
import ProductCard from "./ProductCard";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const FeaturedProducts = () => {
  const navigate = useNavigate();
  const featured = products.filter((p) => p.isWholesale || p.originalPrice).slice(0, 4);

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
