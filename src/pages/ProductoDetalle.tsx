import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { ArrowLeft, Heart, Minus, Plus, ShoppingCart, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import PriceTiers from "@/components/surte/PriceTiers";
import { motion } from "framer-motion";
import { useProfile, getPriceForType } from "@/hooks/useProfile";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { data: profile } = useProfile();
  const businessType = (profile as any)?.business_type;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

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
      <div className="min-h-screen bg-background">
        <div className="aspect-square bg-muted animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
          <div className="h-6 bg-muted animate-pulse rounded w-2/3" />
          <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        </div>
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

  const userPrice = getPriceForType(businessType, product.price, product.price_wholesale, product.price_distributor);
  const discount = product.original_price
    ? Math.round(((product.original_price - userPrice) / product.original_price) * 100)
    : 0;

  const outOfStock = product.stock <= 0;

  const handleAdd = () => {
    if (outOfStock) return;
    addItem(product, qty);
    setAdded(true);
    toast.success(`${product.name} agregado al carrito`);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: product.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Image */}
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-8xl opacity-15 font-heading font-bold text-muted-foreground">{product.name.charAt(0)}</span>
        )}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex gap-2">
            <button onClick={handleShare} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <Share2 size={18} className="text-foreground" />
            </button>
            <button onClick={() => toggleFavorite(product.id)} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <Heart size={20} className={isFavorite(product.id) ? "text-destructive fill-destructive" : "text-muted-foreground"} />
            </button>
          </div>
        </div>
        {discount > 0 && (
          <span className="absolute bottom-4 left-4 bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded-full">-{discount}%</span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center">
            <span className="bg-card text-foreground text-sm font-heading font-bold px-4 py-1.5 rounded-full">Agotado</span>
          </div>
        )}
      </div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 py-4"
      >
        <div className="flex flex-wrap gap-2 mb-2">
          {product.is_fresh && <span className="badge-fresh">🌿 Fresco</span>}
          {product.is_wholesale && <span className="badge-wholesale">💰 Mayorista</span>}
          {(product as any).categories?.name && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">{(product as any).categories.name}</span>
          )}
        </div>

        <h1 className="text-xl font-heading font-bold text-foreground mb-1" style={{ textWrap: "balance" }}>{product.name}</h1>
        <p className="text-sm text-muted-foreground mb-3">{product.unit}</p>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-heading font-bold text-foreground">{formatPrice(product.price)}</span>
          {product.original_price && (
            <span className="text-base text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
          )}
        </div>

        <div className="mb-4">
          <PriceTiers price={product.price} priceWholesale={product.price_wholesale} priceDistributor={product.price_distributor} />
        </div>

        {product.description && (
          <div className="mb-4">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-1">Descripción</h3>
            <p className="text-sm text-muted-foreground leading-relaxed" style={{ textWrap: "pretty" }}>{product.description}</p>
          </div>
        )}

        <div className="bg-card rounded-xl p-3 flex items-center justify-between" style={{ boxShadow: "var(--shadow-card)" }}>
          <span className="text-sm text-muted-foreground">
            {outOfStock ? (
              <span className="text-destructive font-medium">Sin stock disponible</span>
            ) : (
              <>Stock: <span className="font-medium text-foreground">{product.stock} disponibles</span></>
            )}
          </span>
        </div>
      </motion.div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-40 flex items-center gap-3" style={{ boxShadow: "var(--shadow-nav)" }}>
        <div className="flex items-center gap-3 bg-muted rounded-xl px-2">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Minus size={16} />
          </button>
          <span className="text-sm font-semibold w-6 text-center tabular-nums">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-9 h-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Plus size={16} />
          </button>
        </div>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className={`flex-1 py-3 text-sm flex items-center justify-center gap-2 rounded-xl font-heading font-semibold transition-all active:scale-[0.97] ${
            added
              ? "bg-accent text-accent-foreground"
              : outOfStock
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "btn-surte"
          }`}
        >
          {added ? (
            <>
              <CheckCircle2 size={18} />
              ¡Agregado!
            </>
          ) : (
            <>
              <ShoppingCart size={18} />
              Agregar {formatPrice(product.price * qty)}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProductoDetalle;
