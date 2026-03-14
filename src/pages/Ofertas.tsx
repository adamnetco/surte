import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import ProductCard from "@/components/surte/ProductCard";
import { products } from "@/data/mockData";

const Ofertas = () => {
  const ofertas = products.filter((p) => p.originalPrice);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-1">Ofertas</h1>
        <p className="text-sm text-muted-foreground mb-4">Los mejores precios para tu negocio</p>
        <div className="grid grid-cols-2 gap-3">
          {ofertas.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {ofertas.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">No hay ofertas disponibles</p>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Ofertas;
