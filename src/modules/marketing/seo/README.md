# marketing/seo module

SEO and analytics primitives used across the storefront, admin, and auth surfaces.

## Contents

- `HeadMeta.tsx` — per-route `<head>` meta (title, description, canonical, og:*).
- `JsonLd.tsx` — JSON-LD injector + schema builders (LocalBusiness, Product, Breadcrumb, WebSite, ItemList, FAQ).
- `SeoBreadcrumbs.tsx` — accessible breadcrumb UI + BreadcrumbList JSON-LD.
- `Analytics.tsx` — GA4 + Facebook Pixel loader and e-commerce event helpers.

## Rules

- Consumers MUST import from `@/modules/marketing/seo` (barrel) — never from deep paths.
- No cross-module imports. Only depends on `@/hooks/useStore`, `@/components/ui/*`, and `react-router-dom`.
- Keep `BASE_URL` / canonical domain logic centralized here.

## Next module

Suggested: `notifications` (push, web push opt-in, toast scaffolding) or `integrations` (whatsapp, sync, ycloud).
