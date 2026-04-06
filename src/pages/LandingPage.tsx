import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import FloatingCart from "@/components/surte/FloatingCart";
import StoreFooter from "@/components/surte/StoreFooter";
import ProductCard from "@/components/surte/ProductCard";
import HeadMeta from "@/components/seo/HeadMeta";
import JsonLd, { buildBreadcrumbSchema } from "@/components/seo/JsonLd";
import { useProducts, useAppSettings } from "@/hooks/useStore";
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

  // Filter products relevant to the page keywords
  const filtered = (() => {
    if (!products || !page) return products?.slice(0, 50) || [];
    const keywords = (page.title + " " + (page.heading || "") + " " + (page.meta_title || "")).toLowerCase();
    // Try filtering by tags or name matching keywords
    const relevant = products.filter((p: any) => {
      const pName = p.name?.toLowerCase() || "";
      const pDesc = p.description?.toLowerCase() || "";
      const pBrand = p.brand?.toLowerCase() || "";
      const pTags = (p.tags || []).join(" ").toLowerCase();
      return keywords.split(" ").some((kw: string) => 
        kw.length > 3 && (pName.includes(kw) || pDesc.includes(kw) || pBrand.includes(kw) || pTags.includes(kw))
      );
    });
    return relevant.length > 0 ? relevant.slice(0, 50) : products.slice(0, 12);
  })();

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
        {/* Hero banner */}
        {page.image_url && (
          <div className="rounded-2xl overflow-hidden mb-5 relative">
            <img src={page.image_url} alt={page.title} className="w-full h-52 object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
              <h1 className="text-xl font-heading font-bold text-white leading-tight">{page.heading || page.title}</h1>
            </div>
          </div>
        )}

        {!page.image_url && (
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{page.heading || page.title}</h1>
        )}

        {page.body_html && (
          <div
            className="prose prose-sm max-w-none text-muted-foreground mb-6 [&_h2]:text-foreground [&_h2]:font-heading [&_h2]:text-lg [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:space-y-1 [&_li]:text-sm [&_p]:text-sm [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: page.body_html }}
          />
        )}

        {/* CTA WhatsApp */}
        <div className="bg-accent/10 rounded-xl p-4 mb-6 text-center">
          <p className="text-sm font-heading font-semibold text-foreground mb-2">¿Necesitas precios mayoristas?</p>
          <a
            href={`https://wa.me/${settings?.whatsapp_number || '573001234567'}?text=${encodeURIComponent(`Hola, vi la página ${page.title} y me gustaría cotizar`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2.5 rounded-full text-sm font-bold hover:bg-accent/90 transition-colors"
          >
            💬 Cotizar por WhatsApp
          </a>
        </div>

        {filtered.length > 0 && (
          <section>
            <h2 className="text-lg font-heading font-bold text-foreground mb-3">Productos relacionados</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p, i) => (
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
