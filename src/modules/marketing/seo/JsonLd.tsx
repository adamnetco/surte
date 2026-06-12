import { useEffect } from "react";

interface JsonLdProps {
  data: Record<string, any>;
  id?: string;
}

/**
 * Injects a JSON-LD script tag into the document head.
 * Cleans up on unmount.
 */
const JsonLd = ({ data, id }: JsonLdProps) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    if (id) script.id = `jsonld-${id}`;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [data, id]);

  return null;
};

export default JsonLd;

/** Origin actual (SSR-safe). Cae a string vacío si no hay window. */
const safeOrigin = (): string =>
  typeof window !== "undefined" ? window.location.origin : "";

/** Lee área de cobertura desde settings (CSV) o devuelve []. */
const parseAreaServed = (settings: Record<string, string>): { "@type": "City"; name: string }[] => {
  const raw = settings.seo_area_served || settings.business_area_served || "";
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((name) => ({ "@type": "City" as const, name }));
};

/**
 * Generate LocalBusiness JSON-LD a partir de app_settings tenant-aware.
 * Claves usadas: seo_site_name, store_name, seo_default_description, whatsapp_number,
 * footer_email, footer_address, seo_locality, seo_region, seo_country,
 * seo_latitude, seo_longitude, seo_area_served (CSV), store_logo,
 * social_facebook, social_instagram, social_tiktok.
 */
export const buildLocalBusinessSchema = (settings: Record<string, string>) => {
  const origin = settings.site_url || safeOrigin();
  const lat = settings.seo_latitude ? Number(settings.seo_latitude) : undefined;
  const lng = settings.seo_longitude ? Number(settings.seo_longitude) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${origin}/#business`,
    name: settings.seo_site_name || settings.store_name || "",
    description: settings.seo_default_description || "",
    url: origin,
    telephone: settings.whatsapp_number ? `+${settings.whatsapp_number}` : undefined,
    email: settings.footer_email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.footer_address || "",
      addressLocality: settings.seo_locality || "",
      addressRegion: settings.seo_region || "",
      addressCountry: settings.seo_country || "CO",
    },
    geo: lat && lng
      ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng }
      : undefined,
    areaServed: parseAreaServed(settings),
    priceRange: settings.seo_price_range || "$$",
    image: settings.store_logo || undefined,
    sameAs: [
      settings.social_facebook,
      settings.social_instagram,
      settings.social_tiktok,
    ].filter(Boolean),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: settings.business_hours_open || "07:00",
      closes: settings.business_hours_close || "18:00",
    },
  };
};

/**
 * Generate Product JSON-LD with schema.org + Google Merchant compatibility
 */
export const buildProductSchema = (
  product: any,
  settings: Record<string, string>
) => {
  const origin = settings.site_url || safeOrigin();
  const url = `${origin}/producto/${product.slug || product.id}`;
  const imageUrl = product.image_url || settings.default_product_image || "";
  const sellerName = settings.store_name || settings.seo_site_name || "";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    name: product.meta_title || product.name,
    description: product.meta_description || product.description || "",
    image: imageUrl,
    url,
    sku: product.sku || product.id,
    gtin: product.gtin || undefined,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : sellerName ? { "@type": "Brand", name: sellerName } : undefined,
    category: product.categories?.name || undefined,
    weight: product.weight
      ? { "@type": "QuantitativeValue", value: product.weight, unitCode: "KGM" }
      : undefined,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: settings.currency_code || "COP",
      price: product.price,
      priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: sellerName ? { "@type": "Organization", name: sellerName } : undefined,
      itemCondition: "https://schema.org/NewCondition",
    },
  };
};

/**
 * Generate BreadcrumbList JSON-LD
 */
export const buildBreadcrumbSchema = (
  items: { name: string; url: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});

/**
 * Generate WebSite JSON-LD with SearchAction
 */
export const buildWebSiteSchema = (settings: Record<string, string>) => {
  const origin = settings.site_url || safeOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.seo_site_name || settings.store_name || "",
    url: origin,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/catalogo?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
};

/**
 * Generate ItemList JSON-LD for product collections
 */
export const buildProductListSchema = (
  products: any[],
  listName: string,
  listUrl: string,
  settings?: Record<string, string>
) => {
  const origin = settings?.site_url || safeOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: listUrl,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${origin}/producto/${p.slug || p.id}`,
      name: p.name,
    })),
  };
};

/**
 * Generate FAQPage JSON-LD — boosts SERP rich snippets for local SEO.
 */
export const buildFaqSchema = (
  faqs: { question: string; answer: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
});
