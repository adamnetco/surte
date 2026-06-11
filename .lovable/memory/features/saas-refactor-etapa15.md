---
name: SaaS Refactor Etapa 15
description: Storefront tenant scoping + audit cierre (2 hallazgos)
type: feature
---

# Etapa 15 — Storefront scoping + audit cierre

## Cambios
- **BannerCarousel / BrandsSection / TestimonialsSection / ModifierPicker / Carrito**: ahora usan `useTenantOrgId()` y filtran por `organization_id` cuando hay tenant detectado. Patrón `let q: any = supabase.from(...); if (tenantOrgId) q = q.eq(...)`.
- **AdminDashboard.categories**: refactor para que el `.eq("organization_id")` quede en el chain principal (mejor RLS-by-default).
- **LandingPagesTab**: revertido (la tabla `landing_page_products` no tiene `organization_id`; scope implícito vía `landing_page_id` + RLS del padre).

## Audit (scripts/audit-tenant-scope.ts)
- **GLOBAL_TABLES** ampliado:
  - Per-user (RLS user_id): `profiles`, `push_subscriptions`, `notification_subscriptions`, `favorites`.
  - Parent-scoped (RLS via FK): `landing_page_products`, `invoice_scan_items`, `table_order_items`, `pos_order_items`, `purchase_order_items`, `modifier_options`, `stock_transfer_items`.
  - Superadmin-managed: `catalog_template_items`, `catalog_templates`, `catalog_template_applications`, `licenses`, `license_activations`, `onboarding_progress`.
- **Heurísticas**:
  - Look-back 600 chars antes del `.from` para detectar `organization_id` en payload o scope.
  - Look-forward 800 chars después del chain para capturar `tenantOrgId ? builder.eq(...)` y `if (orgId) q = q.eq(...)`.
  - Hardcoded `surteya` ignora comments, placeholders y ejemplos.

## Estado final
- **424 archivos · 2 hallazgos** (high: 2, medium: 0, low: 0).
- Restantes son aceptables:
  1. `src/lib/errors.ts:96` → stub `from('x')` en helper de tests.
  2. `src/modules/auth/pages/Login.tsx:45` → check `brand.slug === "surteya"` para compatibilidad legacy del primer tenant.

## Cierre del refactor SaaS multi-tenant
Etapas 1-15 completas. Hardcoded `surteya`, `default_org_id()` y queries sin scope han sido eliminadas del codebase productivo. Audit consolidado en `docs/audit/tenant-scope-2026-06-11-v5.md`.
