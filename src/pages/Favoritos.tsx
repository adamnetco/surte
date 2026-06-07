import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import ProductCard from "@/modules/storefront/components/ProductCard";
import { useProducts } from "@/hooks/useStore";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";

const Favoritos = () => {
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const { data: products } = useProducts();
  const favProducts = products?.filter((p) => favorites.includes(p.id)) ?? [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <SeoBreadcrumbs items={[{ label: "Favoritos" }]} className="mb-2" />
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-heading font-bold text-foreground">Favoritos</h1>
        </div>

        {favProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Heart size={48} strokeWidth={1.2} className="mb-3 opacity-40" />
            <p className="font-heading font-semibold text-lg mb-1">Sin favoritos</p>
            <p className="text-sm">Toca el ❤️ en un producto para guardarlo</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Favoritos;