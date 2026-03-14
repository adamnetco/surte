import { Heart, Plus } from "lucide-react";
import { Product } from "@/data/mockData";
import { useCart } from "@/context/CartContext";
import { motion } from "framer-motion";

interface ProductCardProps {
  product: Product;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductCard = ({ product }: ProductCardProps) => {
  const { addItem } = useCart();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-product flex flex-col"
    >
      {/* Image area */}
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        <div className="text-4xl opacity-30 font-heading font-bold text-muted-foreground">
          {product.name.charAt(0)}
        </div>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isFresh && <span className="badge-fresh">🌿 Fresco</span>}
          {product.isWholesale && <span className="badge-wholesale">💰 Mayorista</span>}
        </div>
        <button className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
          <Heart size={16} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{product.unit}</p>
        <h3 className="text-sm font-medium text-foreground leading-tight mb-1 line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="text-base font-heading font-bold text-foreground">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && (
              <span className="block text-xs text-muted-foreground line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          <button
            onClick={() => addItem(product)}
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
