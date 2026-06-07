import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import FloatingCart from "@/modules/storefront/components/FloatingCart";
import StoreFooter from "@/modules/storefront/components/StoreFooter";
import ProductCard from "@/modules/storefront/components/ProductCard";
import HeadMeta from "@/modules/marketing/seo/HeadMeta";
import JsonLd, { buildBreadcrumbSchema } from "@/modules/marketing/seo/JsonLd";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { useProducts, useAppSettings } from "@/modules/storefront/hooks/useStore";
import { Package } from "lucide-react";
import { motion } from "framer-motion";

const BASE_URL = "https://surteya.com";

const LandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: settings } = useAppSettings();

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["landing_page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: products } = useProducts();

  // Fetch linked products for this landing page
  const { data: linkedProductIds } = useQuery({
    queryKey: ["landing_page_products", page?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_products")
        .select("product_id")
        .eq("landing_page_id", page!.id)
        .order("sort_order");
      if (error) throw error;
      return data.map((r: any) => r.product_id);
    },
    enabled: !!page?.id,
  });

  // Linked products (curated for this page)
  const linkedProducts = linkedProductIds?.length
    ? (products?.filter(p => linkedProductIds.includes(p.id)).sort((a, b) => linkedProductIds.indexOf(a.id) - linkedProductIds.indexOf(b.id)) || [])
    : [];

  // Other products (excluding linked ones)
  const otherProducts = linkedProductIds?.length
    ? (products?.filter(p => !linkedProductIds.includes(p.id)).slice(0, 20) || [])
    : (products?.slice(0, 50) || []);

  const storeName = settings?.store_name || "SURTÉ YA";
  const pageUrl = `${BASE_URL}/s/${slug}`;
  const metaTitle = page?.meta_title || page?.title || slug || "Página";
  const metaDesc = page?.meta_description || `${page?.title} en ${storeName}. Envíos a domicilio en Santander.`;

  const breadcrumbs = [
    { name: "Inicio", url: BASE_URL },
    { name: page?.title || slug || "", url: pageUrl },
  ];

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: metaTitle,
    description: metaDesc,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: storeName, url: BASE_URL },
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopBar />
        <div className="px-4 py-8 space-y-4">
          <div className="h-8 w-2/3 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopBar />
        <div className="text-center py-20 text-muted-foreground">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-heading font-semibold">Página no encontrada</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeadMeta title={metaTitle} description={metaDesc} canonical={pageUrl} ogImage={page.image_url || undefined} />
      <JsonLd data={webPageSchema} id="webpage" />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbs)} id="breadcrumb" />
      <TopBar />

      <main className="px-4 py-4">
        <SeoBreadcrumbs items={[{ label: page.title || slug || "Página" }]} className="mb-2" />
        {page.image_url && (
          <div className="rounded-2xl overflow-hidden mb-4">
            <img src={page.image_url} alt={page.title} className="w-full h-48 object-cover" loading="lazy" />
          </div>
        )}

        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{page.heading || page.title}</h1>

        {page.body_html && (
          <div
            className="prose prose-sm max-w-none text-muted-foreground mb-6"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body_html) }}
          />
        )}

        {linkedProducts.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-heading font-bold text-foreground mb-3">Productos destacados</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {linkedProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {otherProducts.length > 0 && (
          <section>
            <h2 className="text-lg font-heading font-bold text-foreground mb-3">
              {linkedProducts.length > 0 ? "Otros productos" : "Productos destacados"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {otherProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      <StoreFooter />
      <FloatingCart />
      <BottomNav />
    </div>
  );
};

export default LandingPage;
