import { Heart, ShoppingCart, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface ProductCardProps {
  product: Product;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductCard = ({ product }: ProductCardProps) => {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const fav = isFavorite(product.id);

  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} agregado al carrito`);
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-product flex flex-col cursor-pointer group"
      onClick={() => navigate(`/producto/${product.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="text-4xl opacity-30 font-heading font-bold text-muted-foreground">
            {product.name.charAt(0)}
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </span>
        )}

        {/* Badges */}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {product.is_fresh && <span className="badge-fresh text-[10px]">🌿 Fresco</span>}
          {product.is_wholesale && <span className="badge-wholesale text-[10px]">💰 Mayor</span>}
        </div>

        {/* Favorite */}
        <button
          onClick={handleFav}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110"
        >
          <Heart size={15} className={fav ? "text-destructive fill-destructive" : "text-muted-foreground"} />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye size={24} className="text-foreground/60" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{product.unit}</p>
        <h3 className="text-sm font-medium text-foreground leading-tight mb-auto line-clamp-2">{product.name}</h3>
        <div className="flex items-end justify-between pt-2 mt-1">
          <div>
            <span className="text-base font-heading font-bold text-foreground">{formatPrice(product.price)}</span>
            {product.original_price && (
              <span className="block text-[11px] text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="w-9 h-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
            aria-label="Agregar al carrito"
          >
            <ShoppingCart size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
