---
name: SaaS Refactor — Etapa 6 (POS offline + storefront por host)
description: Outbox POS inyecta organization_id en todos los inserts; hook useTenantSite resuelve org por hostname; Hub.tsx y sitemap multi-tenant.
type: feature
---

# Etapa 6 — POS offline + Storefront por host

## Cambios

### 1. Outbox POS (`src/modules/offline/lib/outbox.ts`)
- `executeOp` ahora valida `organization_id` antes de cualquier insert y lo inyecta en:
  - `pos_orders` (header)
  - `pos_order_items` (cada línea)
  - `pos_payments` (cada pago, ambos paths)
  - `pos_quotes`, `parked_tickets`
  - `apply_stock_movement` RPC (parámetro `_org_id`)
- Idempotencia de `pos_order_create`: el lookup por `client_uuid` agrega `.eq('organization_id', orgId)` para evitar colisiones cross-tenant.
- `einvoice_emit`: el body al edge function `innapsis-emit` incluye `organization_id`.

### 2. Hook tenant-por-host (`src/modules/tenant/lib/useTenantSite.ts`)
- `useTenantSite()` → React Query (10 min stale) que llama a `resolve_tenant_by_host(_host)`.
- Fallback a `tenant_sites.slug` cuando el host es preview de Lovable (`*.lovable.app`) o hay override `?tenant=<slug>`.
- Skip automático si el host es del panel (admin/mi/pos/app/www) — devuelve null.
- Helper `useTenantOrgId()` para uso directo en queries.

### 3. Hub storefront (`src/modules/storefront/pages/Hub.tsx`)
- Reemplazadas queries de `brands` y `featured_sections` por `scopedFrom(..., tenantOrgId)`.
- queryKey incluye `tenantOrgId` para invalidar al cambiar de tenant.
- `enabled: !!tenantOrgId` evita queries hasta resolver el host.

### 4. Sitemap edge function (`supabase/functions/sitemap/index.ts`)
- Resuelve `tenantOrgId` desde `?host=` query param o header `Host` vía `resolve_tenant_by_host` RPC.
- Aplica `.eq('organization_id', tenantOrgId)` a las queries de `products`, `categories`, `brands` (GMC feed + sitemaps segmentados).
- Fallback legacy: si no hay tenant resuelto, sirve datos sin filtro (backward compat con surteya).

## Notas técnicas
- `resolve_tenant_by_host` ya existe (Etapa anterior) y devuelve `organization_id`, `slug`, `logo_url`, etc.
- Las queries del storefront en otros pages (`ProductoDetalle`, `Catalogo`, `Ofertas`) aún usan hooks `useProducts/useCategories` que internamente no filtran por org — pendiente Etapa 7.

## Próxima etapa (Etapa 7)
- Refactorizar `useStore` hooks (useProducts, useCategories, useAppSettings) para aceptar `organizationId` derivado de `useTenantOrgId()`.
- Migrar `ProductoDetalle`, `Catalogo`, `Ofertas`.
- Refactorizar admin tabs restantes (`ProductsTab`, `Compras`, `CouponsTab`, `FiscalSettingsTab`, `SeoContentTab`).
