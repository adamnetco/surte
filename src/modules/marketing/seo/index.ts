// Public barrel for the marketing/seo module.
// Consumers should import from "@/modules/marketing/seo" instead of deep paths.
export { default as HeadMeta } from "./HeadMeta";
export {
  default as JsonLd,
  buildLocalBusinessSchema,
  buildProductSchema,
  buildBreadcrumbSchema,
  buildWebSiteSchema,
  buildProductListSchema,
  buildFaqSchema,
} from "./JsonLd";
export { default as SeoBreadcrumbs, type BreadcrumbSegment } from "./SeoBreadcrumbs";
export {
  default as Analytics,
  trackAddToCart,
  trackPurchase,
  trackViewProduct,
} from "./Analytics";
