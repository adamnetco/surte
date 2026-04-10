import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { ArrowLeft, Heart, Minus, Plus, ShoppingCart, Share2, CheckCircle2, ChevronLeft, ChevronRight, Play, FileText, X, Download, Eye, Box } from "lucide-react";
import { toast } from "sonner";
import PriceTiers from "@/components/surte/PriceTiers";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import FloatingCart from "@/components/surte/FloatingCart";
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
  const { addItem, totalItems, totalPrice } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { data: profile } = useProfile();
  const { data: appSettings } = useAppSettings();
  const businessType = (profile as any)?.business_type;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"descripcion" | "ficha">("descripcion");
  const [selectedPresentation, setSelectedPresentation] = useState<string | null>(null);

  const isUuid = id && /^[0-9a-f]{8}-/.test(id);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories(name, slug)");
      if (isUuid) query = query.eq("id", id!);
      else query = query.eq("slug", id!);
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
      const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId!).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const { data: presentations } = useQuery({
    queryKey: ["product-presentations", productId],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_presentations").select("*").eq("product_id", productId!).eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (product) trackViewProduct(product);
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="hidden md:block"><TopBar /></div>
        <div className="md:hidden h-12 bg-muted animate-pulse" />
        <div className="max-w-6xl mx-auto md:grid md:grid-cols-2 md:gap-8 md:p-6">
          <div className="aspect-square bg-muted animate-pulse md:rounded-xl" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
            <div className="h-6 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
          </div>
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

  const activePres = presentations?.find((p: any) => p.id === selectedPresentation);
  const displayPrice = activePres ? Number(activePres.price) : userPrice;

  const discount = product.original_price
    ? Math.round(((product.original_price - displayPrice) / product.original_price) * 100)
    : 0;
  const outOfStock = product.stock <= 0;

  const handleAdd = () => {
    if (outOfStock) return;
    const maxQty = Math.min(qty, product.stock);
    const presentation = activePres ? { id: activePres.id, name: activePres.name } : undefined;
    addItem(product, maxQty, displayPrice, presentation);
    trackAddToCart(product, maxQty);
    setAdded(true);
    toast.success(`${product.name}${activePres ? ` (${activePres.name})` : ""} agregado al carrito`);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: product.name, url });
    else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }
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

  // Shared product info component
  const ProductInfo = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {product.is_fresh && <span className="badge-fresh text-[10px]">🌿 Fresco</span>}
        {product.is_wholesale && <span className="badge-wholesale text-[10px]">💰 Mayorista</span>}
        {(product as any).categories?.name && (
          <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">{(product as any).categories.name}</span>
        )}
      </div>

      <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground leading-tight mb-0.5" style={{ textWrap: "balance" as any }}>{product.name}</h1>
      <p className="text-xs text-muted-foreground mb-1">
        {product.unit_quantity && product.unit_measure ? `${product.unit_quantity} ${product.unit_measure}` : product.unit}
      </p>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-xl md:text-2xl font-heading font-bold text-foreground">{formatPrice(displayPrice)}</span>
        {(product.original_price || displayPrice < product.price) && (
          <span className="text-sm text-muted-foreground line-through">{formatPrice(product.original_price || product.price)}</span>
        )}
      </div>

      {product.net_weight_grams && product.net_weight_grams > 0 && !activePres && (
        <p className="text-[11px] text-muted-foreground mb-0.5">
          {formatPrice(Math.round(displayPrice / product.net_weight_grams))}/g
          {product.net_weight_grams >= 1000
            ? ` · ${formatPrice(Math.round((displayPrice / product.net_weight_grams) * 1000))}/kg`
            : null}
        </p>
      )}
      {activePres && activePres.weight_kg && (
        <p className="text-[11px] text-muted-foreground mb-0.5">
          {activePres.weight_kg} kg · ×{activePres.conversion_factor} unidades
        </p>
      )}
      {businessType && businessType !== "detal" && displayPrice < product.price && !activePres && (
        <p className="text-[11px] text-accent font-medium mb-2">Precio {businessType.toUpperCase()}</p>
      )}

      {/* Presentations */}
      {presentations && presentations.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Box size={11} /> Presentación
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedPresentation(null)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border ${!selectedPresentation ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
            >
              {product.base_unit || "Unidad"} · {formatPrice(userPrice)}
            </button>
            {presentations.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelectedPresentation(p.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border ${selectedPresentation === p.id ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
              >
                {p.name} · {formatPrice(p.price)}
              </button>
            ))}
          </div>
        </div>
      )}

      <PriceTiers price={product.price} priceWholesale={product.price_wholesale} priceDistributor={product.price_distributor} />

      {/* Tabs */}
      <div className="flex gap-1 mt-3 mb-2 bg-muted rounded-lg p-0.5">
        <button onClick={() => setActiveTab("descripcion")}
          className={`flex-1 text-[11px] font-heading font-semibold py-1.5 rounded-md transition-colors ${activeTab === "descripcion" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Descripción
        </button>
        {pdfFiles.length > 0 && (
          <button onClick={() => setActiveTab("ficha")}
            className={`flex-1 text-[11px] font-heading font-semibold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${activeTab === "ficha" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <FileText size={11} /> Ficha
          </button>
        )}
      </div>

      {activeTab === "descripcion" && product.description && (
        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-3" style={{ textWrap: "pretty" as any }}>{product.description}</p>
      )}

      {activeTab === "ficha" && pdfFiles.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {pdfFiles.map((pdf: any) => (
            <a key={pdf.id} href={pdf.media_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-card rounded-lg p-2.5 border border-border hover:border-accent transition-colors">
              <div className="w-8 h-8 rounded-md bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{pdf.title || "Ficha Técnica"}</p>
                <p className="text-[10px] text-muted-foreground">PDF</p>
              </div>
              <Download size={14} className="text-muted-foreground flex-shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* Stock */}
      <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {outOfStock ? (
            <span className="text-destructive font-medium">Sin stock</span>
          ) : (
            <>Stock: <span className="font-medium text-foreground">{product.stock}</span></>
          )}
        </span>
      </div>
    </motion.div>
  );

  // Shared add to cart bar
  const AddToCartBar = ({ className = "" }: { className?: string }) => (
    <div className={`bg-card border-t border-border ${className}`} style={{ boxShadow: "var(--shadow-nav)" }}>
      {totalItems > 0 && (
        <div className="bg-accent/10 border-b border-accent/20 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            <ShoppingCart size={12} className="text-accent" />
            <span className="text-muted-foreground">{totalItems} {totalItems === 1 ? "item" : "items"}</span>
            <span className="font-heading font-bold text-foreground">{formatPrice(totalPrice)}</span>
          </div>
          <button onClick={() => navigate("/carrito")} className="text-[11px] font-semibold text-accent flex items-center gap-1 active:scale-95 transition-transform">
            <Eye size={12} /> Ver
          </button>
        </div>
      )}
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-1.5">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Minus size={14} />
          </button>
          <span className="text-sm font-semibold w-5 text-center tabular-nums">{qty}</span>
          <button onClick={() => setQty((prev) => Math.min(prev + 1, product.stock || 999))} className="w-8 h-8 flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Plus size={14} />
          </button>
        </div>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-2 rounded-xl font-heading font-semibold transition-all active:scale-[0.97] ${
            added ? "bg-accent text-accent-foreground"
              : outOfStock ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "btn-surte"
          }`}
        >
          {added ? <><CheckCircle2 size={16} /> ¡Agregado!</> : <><ShoppingCart size={16} /> Agregar {formatPrice(displayPrice * qty)}</>}
        </button>
      </div>
    </div>
  );

  // Media gallery component
  const MediaGallery = ({ desktopMode = false }: { desktopMode?: boolean }) => (
    <div>
      <div
        className={`relative bg-muted overflow-hidden ${desktopMode ? "aspect-square rounded-xl" : ""}`}
        style={!desktopMode ? { height: "50vw", maxHeight: "280px", minHeight: "180px" } : undefined}
        onClick={() => currentMedia.type === "image" && currentMedia.url && setLightboxOpen(true)}
        onTouchStart={(e) => { setTouchStart(e.touches[0].clientX); setTouchDelta(0); }}
        onTouchMove={(e) => { if (touchStart !== null) setTouchDelta(e.touches[0].clientX - touchStart); }}
        onTouchEnd={() => {
          if (Math.abs(touchDelta) > 50 && allMedia.length > 1) { touchDelta < 0 ? goMedia(1) : goMedia(-1); }
          setTouchStart(null); setTouchDelta(0);
        }}
      >
        {currentMedia.type === "image" ? (
          currentMedia.url ? (
            <img src={currentMedia.url} alt={product.name} className="w-full h-full object-cover cursor-zoom-in transition-transform duration-200"
              style={{ transform: touchStart !== null ? `translateX(${touchDelta * 0.4}px)` : undefined }} />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-15 font-heading font-bold text-muted-foreground">{product.name.charAt(0)}</span>
          )
        ) : currentMedia.type === "video" ? (
          <video src={currentMedia.url} controls className="w-full h-full object-contain bg-foreground/5" playsInline />
        ) : null}

        {allMedia.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); goMedia(-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center z-10">
              <ChevronLeft size={14} className="text-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); goMedia(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center z-10">
              <ChevronRight size={14} className="text-foreground" />
            </button>
          </>
        )}

        {discount > 0 && <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full z-10">-{discount}%</span>}
        {outOfStock && (
          <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center z-10">
            <span className="bg-card text-foreground text-xs font-heading font-bold px-3 py-1 rounded-full">Agotado</span>
          </div>
        )}

        {allMedia.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {allMedia.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setActiveMediaIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeMediaIdx ? "bg-accent w-4" : "bg-card/60"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {allMedia.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
          {allMedia.map((m, i) => (
            <button key={i} onClick={() => setActiveMediaIdx(i)}
              className={`relative w-11 h-11 md:w-14 md:h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${i === activeMediaIdx ? "border-accent" : "border-transparent"}`}>
              {m.type === "image" ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center"><Play size={12} className="text-muted-foreground" /></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <HeadMeta
        title={product.meta_title || `${product.name} — SURTÉ YA`}
        description={product.meta_description || product.description || `Compra ${product.name} al mejor precio en Bucaramanga`}
        canonical={productUrl}
        ogImage={product.image_url || settings.default_product_image}
        ogType="product"
      />
      <JsonLd data={buildProductSchema(product, settings)} id={`product-${product.id}`} />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbs)} id="breadcrumb" />

      {/* ===== MOBILE LAYOUT ===== */}
      <div className="md:hidden h-[100dvh] flex flex-col bg-background overflow-hidden">
        {/* Sticky Top Bar */}
        <div className="flex-shrink-0 sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-3 py-2">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <h2 className="flex-1 mx-3 text-sm font-heading font-semibold text-foreground truncate text-center">{product.name}</h2>
            <div className="flex gap-1.5">
              <button onClick={handleShare} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
                <Share2 size={16} className="text-foreground" />
              </button>
              <button onClick={() => toggleFavorite(product.id)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
                <Heart size={16} className={isFavorite(product.id) ? "text-destructive fill-destructive" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <MediaGallery />
          <div className="px-4 pt-3 pb-4">
            <ProductInfo />
          </div>
        </div>

        <AddToCartBar className="flex-shrink-0 z-40" />
      </div>

      {/* ===== DESKTOP/TABLET LAYOUT ===== */}
      <div className="hidden md:block min-h-screen bg-background pb-0">
        <TopBar />
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Back + actions */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} /> Volver
            </button>
            <div className="flex gap-2">
              <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm text-foreground hover:bg-muted/80 transition-colors">
                <Share2 size={14} /> Compartir
              </button>
              <button onClick={() => toggleFavorite(product.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm transition-colors hover:bg-muted/80">
                <Heart size={14} className={isFavorite(product.id) ? "text-destructive fill-destructive" : "text-muted-foreground"} />
                {isFavorite(product.id) ? "Guardado" : "Guardar"}
              </button>
            </div>
          </div>

          {/* Split layout */}
          <div className="grid grid-cols-2 gap-8">
            {/* Left: Gallery */}
            <div className="sticky top-20">
              <MediaGallery desktopMode />
            </div>

            {/* Right: Info + Add to cart */}
            <div className="space-y-4">
              <ProductInfo />
              <AddToCartBar className="rounded-xl border border-border !shadow-none" />
            </div>
          </div>
        </div>
        <FloatingCart />
        <BottomNav />
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
    </>
  );
};

export default ProductoDetalle;
