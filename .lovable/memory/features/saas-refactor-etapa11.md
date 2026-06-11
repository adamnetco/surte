---
name: SaaS Refactor Etapa 11
description: Tenant scoping fixes on Top 6 offenders (POS table orders, cash close, Compras, invoice-ocr, sitemap)
type: feature
---

## Etapa 11 — Top offenders tenant scoping

### Files
- `src/modules/pos/components/TableOrderDrawer.tsx`: filtros `organization_id` en `table_orders`, `table_order_items` (select/update/delete/insert ya OK), `dining_tables`, `products`, y Realtime channel filter por tenant.
- `src/modules/pos/components/CloseSessionDialog.tsx`: `pos_payments`, `pos_orders`, `cash_sessions` ahora scoped por `organization_id`. `cash_denominations` queda global (sin columna `organization_id`).
- `src/modules/admin-cms/pages/Compras.tsx`: `supplier_products` y `products` (search/togglePreferred/remove) y `suppliers.toggleActive` ahora con `.eq("organization_id", orgId)`. Query keys incluyen `orgId`.
- `supabase/functions/sitemap/index.ts`: `landing_pages` y `featured_sections` filtran por `tenantOrgId` cuando hay tenant resuelto. Default sitemap también respeta `tenantOrgId` en `products/categories/brands/landing_pages`.
- `supabase/functions/invoice-ocr/index.ts`: auto-match (`supplier_products`, `products` por `gtin` y por nombre) ahora scoped por `organization_id`. Bonus: eliminada duplicación de `const supabase = createClient()`.

### Pending (Etapa 12)
FiscalSettingsTab, AdminDashboard, outbox.ts, ProductoDetalle, GerenteIA, organization-welcome, CatalogosBase, LandingPagesTab — re-correr `scripts/audit-tenant-scope.ts` para confirmar conteo final.
