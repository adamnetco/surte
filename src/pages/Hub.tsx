import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import ProductCard from "@/components/surte/ProductCard";
import FloatingCart from "@/components/surte/FloatingCart";
import StoreFooter from "@/components/surte/StoreFooter";
import HeadMeta from "@/components/seo/HeadMeta";
import JsonLd, { buildProductListSchema, buildBreadcrumbSchema } from "@/components/seo/JsonLd";
import { useProducts, useCategories, useAppSettings } from "@/hooks/useStore";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpDown, Package } from "lucide-react";
import { motion } from "framer-motion";

const BASE_URL = "https://surteya.com";

const Hub = () => {
  const { type, slug } = useParams<{ type: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");

  const { data: settings } = useAppSettings();
  const { data: categories } = useCategories();
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const categorySlug = type === "categoria" ? slug : "";
  const { data: products, isLoading } = useProducts(categorySlug || undefined);

  // Filter by brand
  const brandFilteredProducts = useMemo(() => {
    if (!products) return [];
    if (type === "marca") {
      const brandName = brands?.find((b) => b.name.toLowerCase().replace(/\s+/g, "-") === slug)?.name;
      if (brandName) return products.filter((p) => p.brand?.toLowerCase() === brandName.toLowerCase());
    }
    return products;
  }, [products, type, slug, brands]);

  const title = useMemo(() => {
    if (type === "categoria") return categories?.find((c) => c.slug === slug)?.name || slug || "Categoría";
    if (type === "marca") return brands?.find((b) => b.name.toLowerCase().replace(/\s+/g, "-") === slug)?.name || slug || "Marca";
    if (type === "ciudad") return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Ciudad";
    return "Productos";
  }, [type, slug, categories, brands]);

  const subtitle = useMemo(() => {
    if (type === "categoria") return `Explora todos los productos de ${title}`;
    if (type === "marca") return `Productos de ${title} — marca aliada`;
    if (type === "ciudad") return `Productos disponibles en ${title}`;
    return "";
  }, [type, title]);

  const sorted = useMemo(() => {
    const base = type === "marca" ? brandFilteredProducts : (products || []);
    let result = [...base];
    if (sortBy === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, brandFilteredProducts, type, sortBy]);

  const cycleSortBy = () =>
    setSortBy(sortBy === "default" ? "price-asc" : sortBy === "price-asc" ? "price-desc" : "default");

  const pageUrl = `${BASE_URL}/hub/${type}/${slug}`;
  const storeName = settings?.store_name || "SURTÉ YA";
  const metaTitle = `${title} — ${storeName} | Compra en línea`;
  const metaDesc = subtitle
    ? `${subtitle}. Compra al mejor precio en ${storeName}. Envíos a Bucaramanga, Floridablanca, Girón y Piedecuesta.`
    : `Productos de ${title} en ${storeName}`;

  const breadcrumbs = [
    { name: "Inicio", url: BASE_URL },
    { name: type === "categoria" ? "Categorías" : type === "marca" ? "Marcas" : "Ciudades", url: `${BASE_URL}/categorias` },
    { name: title, url: pageUrl },
  ];

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: metaDesc,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: storeName, url: BASE_URL },
    ...(type === "ciudad" && {
      about: { "@type": "City", name: title, containedInPlace: { "@type": "AdministrativeArea", name: "Santander" } },
    }),
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeadMeta title={metaTitle} description={metaDesc} canonical={pageUrl} />
      <JsonLd data={collectionSchema} id="collection" />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbs)} id="breadcrumb" />
      {sorted.length > 0 && (
        <JsonLd data={buildProductListSchema(sorted, title, pageUrl)} id="product-list" />
      )}
      <TopBar />
      <main className="px-4 py-4">
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-accent font-semibold mb-1">
            {type === "categoria" ? "Categoría" : type === "marca" ? "Marca" : type === "ciudad" ? "Ciudad" : "Hub"}
          </p>
          <h1 className="text-2xl font-heading font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={cycleSortBy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors active:scale-[0.97] ${
              sortBy !== "default" ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground"
            }`}
          >
            <ArrowUpDown size={14} />
            {sortBy === "price-asc" ? "Menor precio" : sortBy === "price-desc" ? "Mayor precio" : "Ordenar"}
          </button>
          {!isLoading && (
            <span className="flex items-center text-xs text-muted-foreground font-medium ml-auto">
              {sorted.length} producto{sorted.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card-product">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sorted.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
              >
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package size={48} strokeWidth={1.2} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-heading font-semibold mb-1">Sin resultados</p>
            <p className="text-sm">No hay productos disponibles en esta sección</p>
          </div>
        )}
      </main>
      <StoreFooter />
      <FloatingCart />
      <BottomNav />
    </div>
  );
};

export default Hub;
