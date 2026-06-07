import { useState, useCallback } from "react";
import { useProducts } from "@/modules/storefront/hooks/useStore";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/modules/storefront/hooks/useFavorites";
import { useProfile, getPriceForType } from "@/modules/auth/hooks/useProfile";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";
import { Heart, Plus, X, ChevronLeft, ChevronRight, ShoppingCart, Check } from "lucide-react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

interface ProductSwipeOverlayProps {
  currentProductId: string;
  categorySlug?: string | null;
  brand?: string | null;
  tag?: string | null;
  onClose: () => void;
  onNavigate: (slug: string) => void;
}

const SWIPE_THRESHOLD = 60;

/* Animated swipe hint pill */
const SwipeHint = () => (
  <motion.div
    className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-card/80 backdrop-blur-sm rounded-full px-3 py-1"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4, duration: 0.4 }}
  >
    <motion.div
      animate={{ x: [-3, 3, -3] }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
    >
      <ChevronLeft size={12} className="text-muted-foreground" />
    </motion.div>
    <span className="text-[10px] text-muted-foreground font-medium">Desliza</span>
    <motion.div
      animate={{ x: [3, -3, 3] }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
    >
      <ChevronRight size={12} className="text-muted-foreground" />
    </motion.div>
  </motion.div>
);

const ProductSwipeOverlay = ({ currentProductId, categorySlug, brand, tag, onClose, onNavigate }: ProductSwipeOverlayProps) => {
  const { data: allProducts } = useProducts();
  const { addItem, totalItems, setDrawerOpen } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { data: profile } = useProfile();
  const { data: appSettings } = useAppSettings();
  const businessType = (profile as any)?.business_type;

  const [addedId, setAddedId] = useState<string | null>(null);

  const tagLower = tag?.trim().toLowerCase();
  const siblingProducts = (allProducts || []).filter((p: any) => {
    // Always include the current product (used as anchor when present)
    if (currentProductId && p.id === currentProductId) return true;
    if (categorySlug) return p.categories?.slug === categorySlug;
    if (brand) return p.brand?.toLowerCase() === brand.toLowerCase();
    if (tagLower) {
      if (!p.tags || !Array.isArray(p.tags)) return false;
      return p.tags.some((t: string) => {
        const tl = t.toLowerCase().trim();
        return tl === tagLower || tl.includes(tagLower) || tagLower.includes(tl);
      });
    }
    return false;
  });

  const currentIdx = siblingProducts.findIndex((p: any) => p.id === currentProductId);
  const [activeIdx, setActiveIdx] = useState(Math.max(0, currentIdx));
  const [direction, setDirection] = useState(0);

  if (siblingProducts.length === 0) return null;

  const product = siblingProducts[activeIdx] as any;
  if (!product) return null;

  const userPrice = getPriceForType(businessType, product.price, product.price_wholesale, product.price_distributor);
  const imgSrc = product.image_url || appSettings?.default_product_image || "";
  const fav = isFavorite(product.id);
  const outOfStock = product.stock <= 0;
  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const goTo = (dir: number) => {
    const next = (activeIdx + dir + siblingProducts.length) % siblingProducts.length;
    setDirection(dir);
    setActiveIdx(next);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      goTo(info.offset.x < 0 ? 1 : -1);
    }
  };

  const handleAdd = () => {
    if (outOfStock) return;
    addItem(product, 1, userPrice, undefined, undefined, undefined, { openDrawer: false });
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1200);
    toast.success(`${product.name} agregado`);
  };

  const handleOpenDetail = () => {
    const slug = product.slug || product.id;
    onNavigate(slug);
  };

  const handleGoToCart = () => {
    onClose();
    setDrawerOpen(true);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.92 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.92 }),
  };

  const isAdded = addedId === product.id;

  return (
    <div className="fixed inset-0 z-[90] bg-foreground/60 backdrop-blur-sm flex items-center justify-center px-4">
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-[95] w-9 h-9 rounded-full bg-card/90 flex items-center justify-center shadow-lg">
        <X size={18} className="text-foreground" />
      </button>

      {/* Cart badge */}
      {totalItems > 0 && (
        <button
          onClick={handleGoToCart}
          className="absolute top-4 left-4 z-[95] flex items-center gap-1.5 bg-accent text-accent-foreground rounded-full pl-2.5 pr-3 py-1.5 shadow-lg active:scale-95 transition-transform"
        >
          <ShoppingCart size={16} />
          <span className="text-xs font-bold">{totalItems}</span>
        </button>
      )}

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[95] bg-card/90 rounded-full px-3 py-1 text-xs font-medium text-foreground shadow">
        {activeIdx + 1} / {siblingProducts.length}
      </div>

      {/* Nav arrows (desktop) */}
      <button onClick={() => goTo(-1)} className="hidden md:flex absolute left-4 z-[95] w-10 h-10 rounded-full bg-card/90 items-center justify-center shadow-lg hover:bg-card transition-colors">
        <ChevronLeft size={20} className="text-foreground" />
      </button>
      <button onClick={() => goTo(1)} className="hidden md:flex absolute right-4 z-[95] w-10 h-10 rounded-full bg-card/90 items-center justify-center shadow-lg hover:bg-card transition-colors">
        <ChevronRight size={20} className="text-foreground" />
      </button>

      {/* Card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={product.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          className="w-full max-w-[340px] bg-card rounded-2xl overflow-hidden shadow-2xl border border-border cursor-grab active:cursor-grabbing"
          onClick={handleOpenDetail}
        >
          {/* Image */}
          <div className="relative aspect-[4/5] bg-muted overflow-hidden">
            {imgSrc ? (
              <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-heading font-bold text-muted-foreground/20">
                {product.name.charAt(0)}
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {discount > 0 && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">-{discount}%</span>
              )}
              {product.is_fresh && <span className="bg-secondary text-secondary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">🌿 Fresco</span>}
            </div>

            {outOfStock && (
              <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                <span className="bg-card text-foreground text-xs font-heading font-bold px-3 py-1.5 rounded-full">Agotado</span>
              </div>
            )}

            {/* Fav */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center"
            >
              <Heart size={16} className={fav ? "text-destructive fill-destructive" : "text-muted-foreground"} />
            </button>

            {/* Animated swipe hint */}
            <SwipeHint />
          </div>

          {/* Info */}
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              {product.categories?.name || product.brand || ""}
            </p>
            <h3 className="text-base font-heading font-bold text-foreground leading-tight line-clamp-2 mb-1">{product.name}</h3>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-lg font-heading font-bold text-foreground">{formatPrice(userPrice)}</span>
                {product.original_price && product.original_price > userPrice && (
                  <span className="block text-xs text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
                )}
              </div>
              <motion.button
                onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                disabled={outOfStock}
                whileTap={{ scale: 0.85 }}
                animate={isAdded ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  outOfStock
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : isAdded
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "bg-accent text-accent-foreground hover:opacity-90 shadow-sm"
                }`}
              >
                {isAdded ? <Check size={20} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
        {siblingProducts.slice(
          Math.max(0, activeIdx - 4),
          Math.min(siblingProducts.length, activeIdx + 5)
        ).map((p: any, i: number) => {
          const realIdx = Math.max(0, activeIdx - 4) + i;
          return (
            <div
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${realIdx === activeIdx ? "bg-accent w-6" : "bg-card/50 w-1.5"}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ProductSwipeOverlay;
