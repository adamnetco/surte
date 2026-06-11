---
name: SaaS Refactor Etapa 13
description: Tenant scoping for ProductsTab, ShippingTab, ModifiersTab, PresentationsTab
type: feature
---

# Etapa 13 — Hardening tabs admin de catálogo

## Cambios
- **ShippingTab**: `municipality_settings` scoped vía `scopedFrom(orgId)`. Bulk import añade `organization_id` a cada fila.
- **ModifiersTab**: products / modifier_groups / modifier_options filtrados por `currentOrg.id`. queryKeys incluyen orgId.
- **PresentationsTab**: products + product_presentations + all-presentations filtrados por orgId.
- **ProductsTab**:
  - `ProductMediaGallery` recibe `orgId`, scope en `select` y `insert` de product_media.
  - `FeaturedTagsPicker` recibe `orgId`, scope en `featured_sections`.
  - Defense-in-depth: update/delete de products incluyen `.eq("organization_id", orgId)`.
  - Bulk actions (activate/deactivate/set_category/price_pct/add_tag/remove_tag) anclan a `organization_id`.

## Pendiente (Etapa 14)
- Inventario.tsx, SyncMonitor, POS pages (KDS/Mesas/POS), pushClient.ts, send-web-push EF.
- Reescribir regex de `scripts/audit-tenant-scope.ts` para detectar `organization_id` en payloads.
