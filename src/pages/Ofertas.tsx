import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import ProductCard from "@/components/surte/ProductCard";
import { useProducts } from "@/hooks/useStore";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";

const Ofertas = () => {
  const { data: products, isLoading } = useProducts();
  const ofertas = products?.filter((p) => p.original_price) ?? [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-1">Ofertas</h1>
        <p className="text-sm text-muted-foreground mb-4">Los mejores precios para tu negocio</p>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="card-product"><div className="aspect-square bg-muted animate-pulse" /></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ofertas.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        {!isLoading && ofertas.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">No hay ofertas disponibles</p>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Ofertas;
