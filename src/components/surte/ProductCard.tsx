import { Heart, Plus } from "lucide-react";
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

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} agregado`);
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-product flex flex-col cursor-pointer"
      onClick={() => navigate(`/producto/${product.id}`)}
    >
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-4xl opacity-30 font-heading font-bold text-muted-foreground">
            {product.name.charAt(0)}
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_fresh && <span className="badge-fresh">🌿 Fresco</span>}
          {product.is_wholesale && <span className="badge-wholesale">💰 Mayorista</span>}
        </div>
        <button
          onClick={handleFav}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-colors"
        >
          <Heart size={16} className={fav ? "text-destructive fill-destructive" : "text-muted-foreground"} />
        </button>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{product.unit}</p>
        <h3 className="text-sm font-medium text-foreground leading-tight mb-1 line-clamp-2">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="text-base font-heading font-bold text-foreground">{formatPrice(product.price)}</span>
            {product.original_price && (
              <span className="block text-xs text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="w-9 h-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;