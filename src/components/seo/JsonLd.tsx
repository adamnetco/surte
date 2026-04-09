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

/**
 * Generate LocalBusiness JSON-LD
 */
export const buildLocalBusinessSchema = (settings: Record<string, string>) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://surteya.lovable.app/#business",
  name: settings.seo_site_name || settings.store_name || "SURTÉ YA",
  description: settings.seo_default_description || "",
  url: "https://surteya.lovable.app",
  telephone: settings.whatsapp_number ? `+${settings.whatsapp_number}` : undefined,
  email: settings.footer_email || undefined,
  address: {
    "@type": "PostalAddress",
    streetAddress: settings.footer_address || "",
    addressLocality: "Bucaramanga",
    addressRegion: "Santander",
    addressCountry: "CO",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 7.1254,
    longitude: -73.1198,
  },
  areaServed: [
    { "@type": "City", name: "Bucaramanga" },
    { "@type": "City", name: "Floridablanca" },
    { "@type": "City", name: "Girón" },
    { "@type": "City", name: "Piedecuesta" },
  ],
  priceRange: "$$",
  image: settings.store_logo || undefined,
  sameAs: [
    settings.social_facebook,
    settings.social_instagram,
    settings.social_tiktok,
  ].filter(Boolean),
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "07:00",
    closes: "18:00",
  },
});

/**
 * Generate Product JSON-LD with schema.org + Google Merchant compatibility
 */
export const buildProductSchema = (
  product: any,
  settings: Record<string, string>
) => {
  const url = `https://surteya.lovable.app/producto/${product.slug || product.id}`;
  const imageUrl = product.image_url || settings.default_product_image || "";

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
      : { "@type": "Brand", name: settings.store_name || "SURTÉ YA" },
    category: product.categories?.name || undefined,
    weight: product.weight
      ? { "@type": "QuantitativeValue", value: product.weight, unitCode: "KGM" }
      : undefined,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "COP",
      price: product.price,
      priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: settings.store_name || "SURTÉ YA",
      },
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
export const buildWebSiteSchema = (settings: Record<string, string>) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: settings.seo_site_name || "SURTÉ YA",
  url: "https://surteya.lovable.app",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://surteya.lovable.app/catalogo?search={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
});

/**
 * Generate ItemList JSON-LD for product collections
 */
export const buildProductListSchema = (
  products: any[],
  listName: string,
  listUrl: string
) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: listName,
  url: listUrl,
  numberOfItems: products.length,
  itemListElement: products.slice(0, 50).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `https://surteya.lovable.app/producto/${p.slug || p.id}`,
    name: p.name,
  })),
});
