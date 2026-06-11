---
name: SaaS Refactor Etapa 12
description: Tenant scoping en Fiscal/AdminDashboard/outbox/ProductoDetalle/GerenteIA/welcome-email
type: feature
---

## Etapa 12 — Tabs especializadas y storefront

### Cambios
- **FiscalSettingsTab.tsx**: update de `einvoice_configs` ahora anclado a `organization_id + id`. Insert ya incluía `organization_id` vía `blankCfg`.
- **AdminDashboard.tsx**: queries `admin-categories`, `admin-orders`, `admin-settings` ahora filtradas por `currentOrg.id` cuando hay org activa. Query keys incluyen el org id.
- **ProductoDetalle.tsx**: `product_media` y `product_presentations` ahora filtradas por `organization_id` (tenantOrgId del storefront).
- **GerenteIA.tsx**: `ItemMatcher` recibe `orgId` como prop, búsqueda `products` scoped. `invoice_scan_items` documentado: scoping vía `scan_id` (parent ya en `currentOrg`).
- **organization-welcome.tsx**: previewData genérico ("Mi Tienda Demo") en vez de "Surteya".

### No requieren cambio (justificación)
- **outbox.ts** (`pos_order_items`/`pos_payments` insert): el array `lines/pays` se mapea con `organization_id: orgId` explícito antes del insert — el regex del audit no lo ve. Falso positivo.
- **CatalogosBase.tsx** (`catalog_template_items`): tabla global de superadmin, sin `organization_id`. Scoping vía `template_id`.
- **LandingPagesTab.tsx** (`landing_page_products`): sin `organization_id`; scoping vía `landing_page_id` que ya pertenece a `currentOrg`.

### Pendiente (Etapa 13 — barrido final)
- `ProductsTab`, `ShippingTab`, `ModifiersTab`, `PresentationsTab`, `Inventario`, `SyncMonitor`
- POS pages: `KDS.tsx`, `Mesas.tsx`, `POS.tsx`
- `pushClient.ts`, `send-web-push` edge function
- Reescribir el regex del audit para detectar `organization_id` en payloads mapeados.
