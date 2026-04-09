import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { ArrowLeft, Heart, Minus, Plus, ShoppingCart, Share2, CheckCircle2, ChevronLeft, ChevronRight, Play, FileText, X, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import PriceTiers from "@/components/surte/PriceTiers";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile, getPriceForType } from "@/hooks/useProfile";
import JsonLd, { buildProductSchema, buildBreadcrumbSchema } from "@/components/seo/JsonLd";
import HeadMeta from "@/components/seo/HeadMeta";
import { useAppSettings } from "@/hooks/useStore";
import { trackViewProduct, trackAddToCart } from "@/components/seo/Analytics";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { data: profile } = useProfile();
  const { data: appSettings } = useAppSettings();
  const businessType = (profile as any)?.business_type;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"descripcion" | "ficha">("descripcion");

  // Support both UUID and slug
  const isUuid = id && /^[0-9a-f]{8}-/.test(id);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories(name, slug)");
      if (isUuid) {
        query = query.eq("id", id!);
      } else {
        query = query.eq("slug", id!);
      }
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const productId = product?.id;
  const { data: media } = useQuery({
    queryKey: ["product-media", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_media")
        .select("*")
        .eq("product_id", productId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Track view
  useEffect(() => {
    if (product) trackViewProduct(product);
  }, [product?.id]);

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

  // Build gallery: main image + product_media images/videos
  const allMedia: { type: "image" | "video" | "pdf"; url: string; title?: string }[] = [];
  if (product.image_url) allMedia.push({ type: "image", url: product.image_url, title: product.name });
  media?.forEach((m: any) => {
    if (m.media_type === "image") allMedia.push({ type: "image", url: m.media_url, title: m.title });
    if (m.media_type === "video") allMedia.push({ type: "video", url: m.media_url, title: m.title });
  });
  if (allMedia.length === 0) allMedia.push({ type: "image", url: "", title: product.name });

  const pdfFiles = media?.filter((m: any) => m.media_type === "pdf") || [];

  const currentMedia = allMedia[activeMediaIdx] || allMedia[0];
  const userPrice = getPriceForType(businessType, product.price, product.price_wholesale, product.price_distributor);
  const discount = product.original_price
    ? Math.round(((product.original_price - userPrice) / product.original_price) * 100)
    : 0;
  const outOfStock = product.stock <= 0;

  const handleAdd = () => {
    if (outOfStock) return;
    const maxQty = Math.min(qty, product.stock);
    addItem(product, maxQty, userPrice);
    trackAddToCart(product, maxQty);
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

  const goMedia = (dir: number) => {
    setActiveMediaIdx((prev) => (prev + dir + allMedia.length) % allMedia.length);
  };

  const settings = appSettings || {};
  const baseUrl = "https://surteya.com";
  const productUrl = `${baseUrl}/producto/${product.slug || product.id}`;
  const breadcrumbs = [
    { name: "Inicio", url: baseUrl },
    { name: "Catálogo", url: `${baseUrl}/catalogo` },
    ...(product.categories?.name ? [{ name: product.categories.name, url: `${baseUrl}/hub/categoria/${product.categories.slug}` }] : []),
    { name: product.name, url: productUrl },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      <HeadMeta
        title={product.meta_title || `${product.name} — SURTÉ YA`}
        description={product.meta_description || product.description || `Compra ${product.name} al mejor precio en Bucaramanga`}
        canonical={productUrl}
        ogImage={product.image_url || settings.default_product_image}
        ogType="product"
      />
      <JsonLd data={buildProductSchema(product, settings)} id={`product-${product.id}`} />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbs)} id="breadcrumb" />
      {/* Hero Media */}
      <div className="relative aspect-square bg-muted overflow-hidden" onClick={() => currentMedia.type === "image" && currentMedia.url && setLightboxOpen(true)}>
        {currentMedia.type === "image" ? (
          currentMedia.url ? (
            <img src={currentMedia.url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-8xl opacity-15 font-heading font-bold text-muted-foreground">{product.name.charAt(0)}</span>
          )
        ) : currentMedia.type === "video" ? (
          <video src={currentMedia.url} controls className="w-full h-full object-contain bg-foreground/5" playsInline />
        ) : null}

        {/* Nav overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
          <button onClick={(e) => { e.stopPropagation(); navigate(-1); }} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <Share2 size={18} className="text-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <Heart size={20} className={isFavorite(product.id) ? "text-destructive fill-destructive" : "text-muted-foreground"} />
            </button>
          </div>
        </div>

        {/* Arrows */}
        {allMedia.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); goMedia(-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center z-10">
              <ChevronLeft size={16} className="text-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); goMedia(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center z-10">
              <ChevronRight size={16} className="text-foreground" />
            </button>
          </>
        )}

        {discount > 0 && (
          <span className="absolute bottom-4 left-4 bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded-full z-10">-{discount}%</span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center z-10">
            <span className="bg-card text-foreground text-sm font-heading font-bold px-4 py-1.5 rounded-full">Agotado</span>
          </div>
        )}

        {/* Dot indicators */}
        {allMedia.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
            {allMedia.map((m, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setActiveMediaIdx(i); }}
                className={`w-2 h-2 rounded-full transition-all ${i === activeMediaIdx ? "bg-accent w-5" : "bg-card/60"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails strip */}
      {allMedia.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          {allMedia.map((m, i) => (
            <button key={i} onClick={() => setActiveMediaIdx(i)}
              className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${i === activeMediaIdx ? "border-accent" : "border-transparent"}`}>
              {m.type === "image" ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Play size={16} className="text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Product Info */}
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

        <h1 className="text-xl font-heading font-bold text-foreground mb-1" style={{ textWrap: "balance" as any }}>{product.name}</h1>
        <p className="text-sm text-muted-foreground mb-1">
          {product.unit_quantity && product.unit_measure
            ? `${product.unit_quantity} ${product.unit_measure}`
            : product.unit}
        </p>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-heading font-bold text-foreground">{formatPrice(userPrice)}</span>
          {(product.original_price || userPrice < product.price) && (
            <span className="text-base text-muted-foreground line-through">{formatPrice(product.original_price || product.price)}</span>
          )}
        </div>
        {/* Price per gram */}
        {product.net_weight_grams && product.net_weight_grams > 0 && (
          <p className="text-xs text-muted-foreground mb-1">
            {formatPrice(Math.round(userPrice / product.net_weight_grams))}/g
            {product.net_weight_grams >= 1000
              ? ` · ${formatPrice(Math.round((userPrice / product.net_weight_grams) * 1000))}/kg`
              : null}
          </p>
        )}
        {businessType && businessType !== "detal" && userPrice < product.price && (
          <p className="text-xs text-accent font-medium mb-3">Precio {businessType.toUpperCase()}</p>
        )}

        <div className="mb-4">
          <PriceTiers price={product.price} priceWholesale={product.price_wholesale} priceDistributor={product.price_distributor} />
        </div>

        {/* Tabs: Descripción / Ficha Técnica */}
        <div className="flex gap-1 mb-3 bg-muted rounded-lg p-1">
          <button onClick={() => setActiveTab("descripcion")}
            className={`flex-1 text-xs font-heading font-semibold py-2 rounded-md transition-colors ${activeTab === "descripcion" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            Descripción
          </button>
          {pdfFiles.length > 0 && (
            <button onClick={() => setActiveTab("ficha")}
              className={`flex-1 text-xs font-heading font-semibold py-2 rounded-md transition-colors flex items-center justify-center gap-1 ${activeTab === "ficha" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              <FileText size={12} /> Ficha Técnica
            </button>
          )}
        </div>

        {activeTab === "descripcion" && product.description && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed" style={{ textWrap: "pretty" as any }}>{product.description}</p>
          </div>
        )}

        {activeTab === "ficha" && pdfFiles.length > 0 && (
          <div className="mb-4 space-y-2">
            {pdfFiles.map((pdf: any) => (
              <a key={pdf.id} href={pdf.media_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border hover:border-accent transition-colors">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{pdf.title || "Ficha Técnica"}</p>
                  <p className="text-[11px] text-muted-foreground">PDF · Toca para ver</p>
                </div>
                <Download size={16} className="text-muted-foreground flex-shrink-0" />
              </a>
            ))}
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
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40" style={{ boxShadow: "var(--shadow-nav)" }}>
        {/* Cart summary strip */}
        {totalItems > 0 && (
          <div className="bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart size={14} className="text-accent" />
              <span className="text-muted-foreground">{totalItems} {totalItems === 1 ? "producto" : "productos"}</span>
              <span className="font-heading font-bold text-foreground">{formatPrice(totalPrice)}</span>
            </div>
            <button
              onClick={() => navigate("/carrito")}
              className="text-xs font-semibold text-accent flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Eye size={14} /> Ver Carrito
            </button>
          </div>
        )}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-3 bg-muted rounded-xl px-2">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
              <Minus size={16} />
            </button>
            <span className="text-sm font-semibold w-6 text-center tabular-nums">{qty}</span>
            <button onClick={() => setQty((prev) => Math.min(prev + 1, product.stock || 999))} className="w-9 h-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
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
              <><CheckCircle2 size={18} /> ¡Agregado!</>
            ) : (
              <><ShoppingCart size={18} /> Agregar {formatPrice(userPrice * qty)}</>
            )}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-foreground/90 backdrop-blur-md flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/90 flex items-center justify-center z-10" onClick={() => setLightboxOpen(false)}>
              <X size={18} className="text-foreground" />
            </button>
            {allMedia.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); goMedia(-1); }} className="absolute left-3 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center z-10">
                  <ChevronLeft size={18} className="text-foreground" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); goMedia(1); }} className="absolute right-3 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center z-10">
                  <ChevronRight size={18} className="text-foreground" />
                </button>
              </>
            )}
            <motion.img
              key={activeMediaIdx}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={currentMedia.url}
              alt={product.name}
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="absolute bottom-6 text-xs text-primary-foreground/90 bg-foreground/40 px-3 py-1.5 rounded-full">
              {activeMediaIdx + 1} / {allMedia.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductoDetalle;
