import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { ArrowLeft, Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import PriceTiers from "@/components/surte/PriceTiers";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <p className="font-heading font-bold text-lg text-foreground mb-2">Producto no encontrado</p>
        <button onClick={() => navigate("/catalogo")} className="btn-surte px-6 py-2 text-sm">Ver Catálogo</button>
      </div>
    );
  }

  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const handleAdd = () => {
    addItem(product, qty);
    toast.success(`${product.name} agregado al carrito`);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Image */}
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-8xl opacity-20 font-heading font-bold text-muted-foreground">{product.name.charAt(0)}</span>
        )}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <button onClick={() => toggleFavorite(product.id)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
          <Heart size={20} className={isFavorite(product.id) ? "text-destructive fill-destructive" : "text-muted-foreground"} />
        </button>
        {discount > 0 && (
          <span className="absolute top-4 left-16 bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded-full">-{discount}%</span>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {product.is_fresh && <span className="badge-fresh">🌿 Fresco</span>}
          {product.is_wholesale && <span className="badge-wholesale">💰 Mayorista</span>}
          {(product as any).categories?.name && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">{(product as any).categories.name}</span>
          )}
        </div>

        <h1 className="text-xl font-heading font-bold text-foreground mb-1">{product.name}</h1>
        <p className="text-sm text-muted-foreground mb-3">{product.unit}</p>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-heading font-bold text-foreground">{formatPrice(product.price)}</span>
          {product.original_price && (
            <span className="text-base text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
          )}
        </div>

        {product.description && (
          <div className="mb-4">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-1">Descripción</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        )}

        <div className="bg-card rounded-xl p-3 flex items-center justify-between" style={{ boxShadow: "var(--shadow-card)" }}>
          <span className="text-sm text-muted-foreground">
            Stock: <span className="font-medium text-foreground">{product.stock} disponibles</span>
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-40 flex items-center gap-3" style={{ boxShadow: "var(--shadow-nav)" }}>
        <div className="flex items-center gap-3 bg-muted rounded-xl px-2">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center text-foreground">
            <Minus size={16} />
          </button>
          <span className="text-sm font-semibold w-6 text-center">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-9 h-9 flex items-center justify-center text-foreground">
            <Plus size={16} />
          </button>
        </div>
        <button onClick={handleAdd} className="flex-1 btn-surte py-3 text-sm flex items-center justify-center gap-2">
          <ShoppingCart size={18} />
          Agregar {formatPrice(product.price * qty)}
        </button>
      </div>
    </div>
  );
};

export default ProductoDetalle;