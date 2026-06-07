import { memo } from "react";
import { Heart, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/modules/cart/context/CartContext";
import { useFavorites } from "@/modules/storefront/hooks/useFavorites";
import { toast } from "sonner";
import PriceTiers from "./PriceTiers";
import type { Tables } from "@/integrations/supabase/types";
import { useProfile, getPriceForType } from "@/modules/auth/hooks/useProfile";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";

type Product = Tables<"products">;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductCardBase = ({ product }: { product: Product }) => {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: appSettings } = useAppSettings();
  const fav = isFavorite(product.id);
  const businessType = (profile as any)?.business_type;
  const userPrice = getPriceForType(businessType, product.price, product.price_wholesale, product.price_distributor);

  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const lowStock = product.stock > 0 && product.stock <= 10;
  const outOfStock = product.stock <= 0;

  const imgSrc = product.image_url || appSettings?.default_product_image || "";

  // Calculate price per gram if net_weight_grams is available
  const pricePerGram = product.net_weight_grams && product.net_weight_grams > 0
    ? userPrice / product.net_weight_grams
    : null;

  // Unit info display
  const unitInfo = product.unit_quantity && product.unit_measure
    ? `${product.unit_quantity} ${product.unit_measure}`
    : product.unit;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    addItem(product, 1, userPrice);
    toast.success(`${product.name} agregado`);
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  };

  return (
    <div
      className="card-product flex flex-col cursor-pointer group rounded-xl overflow-hidden border border-border bg-card transition-shadow hover:shadow-md"
      onClick={() => navigate(`/producto/${product.slug || product.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="text-3xl opacity-20 font-heading font-bold text-muted-foreground">
            {product.name.charAt(0)}
          </div>
        )}

        {/* Badges TOP */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {discount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              -{discount}%
            </span>
          )}
          {product.is_fresh && <span className="bg-secondary text-secondary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full">🌿 Fresco</span>}
          {product.is_wholesale && <span className="bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full">💰 Mayor</span>}
          {lowStock && !outOfStock && (
            <span className="bg-accent text-accent-foreground text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
              ¡Últimas {product.stock}!
            </span>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
            <span className="bg-card text-foreground text-[10px] font-heading font-bold px-2.5 py-1 rounded-full">Agotado</span>
          </div>
        )}

        <button
          onClick={handleFav}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <Heart size={13} className={fav ? "text-destructive fill-destructive" : "text-muted-foreground"} />
        </button>
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{unitInfo}</p>
        <h3 className="text-[13px] font-medium text-foreground leading-tight mb-auto line-clamp-2">{product.name}</h3>
        <PriceTiers price={product.price} priceWholesale={product.price_wholesale} priceDistributor={product.price_distributor} compact />
        <div className="flex items-end justify-between pt-1.5 mt-1">
          <div>
            <span className="text-[15px] font-heading font-bold text-foreground">{formatPrice(userPrice)}</span>
            {(product.original_price || userPrice < product.price) && (
              <span className="block text-[10px] text-muted-foreground line-through">
                {formatPrice(product.original_price || product.price)}
              </span>
            )}
            {pricePerGram && (
              <span className="block text-[9px] text-muted-foreground">
                {formatPrice(Math.round(pricePerGram))}/g
              </span>
            )}
            {businessType && businessType !== "detal" && userPrice < product.price && (
              <span className="text-[8px] text-accent font-medium">Precio {businessType}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              outOfStock
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-accent text-accent-foreground hover:opacity-90 shadow-sm"
            }`}
            aria-label="Agregar al carrito"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Perf: ProductCard se renderiza en grids de 20-100+ items. memo evita re-render
// cuando cambia el carrito o el padre re-renderiza, mientras el producto siga igual.
// Comparamos solo los campos visibles para que cambios irrelevantes (timestamps,
// columnas internas) no fuercen re-render.
const ProductCard = memo(ProductCardBase, (prev, next) => {
  const a = prev.product;
  const b = next.product;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.price === b.price &&
    a.price_wholesale === b.price_wholesale &&
    a.price_distributor === b.price_distributor &&
    a.original_price === b.original_price &&
    a.stock === b.stock &&
    a.image_url === b.image_url &&
    a.is_fresh === b.is_fresh &&
    a.is_wholesale === b.is_wholesale &&
    a.slug === b.slug &&
    a.unit === b.unit &&
    a.unit_quantity === b.unit_quantity &&
    a.unit_measure === b.unit_measure &&
    a.net_weight_grams === b.net_weight_grams
  );
});

export default ProductCard;
