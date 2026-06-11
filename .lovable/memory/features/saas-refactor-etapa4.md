---
name: SaaS Refactor Etapa 4 — Endurecimiento multi-tenant
description: organization_id NOT NULL + FK en 16 tablas, default_org_id deprecado, current_org_id helper, inserts del CMS pasan organization_id explícito
type: feature
---

## Etapa 4 completada (2026-06-11)

### DB
- Backfill `product_presentations.organization_id` desde `products` (25 filas).
- Backfill `persistent_carts` huérfanos → org `surteya`.
- `NOT NULL + FK (organizations ON DELETE CASCADE) + idx_<tabla>_org` aplicado a:
  products, categories, brands, product_presentations, hero_slides, banners,
  landing_pages, featured_sections, gallery, customer_reviews, crm_leads,
  custom_scripts, seo_content, modifier_groups, modifier_options, shipping_zones.
- `default_org_id()` ahora RAISE EXCEPTION (deprecada). EXECUTE revocado.
- Nueva `current_org_id()` SECURITY DEFINER → primer membership activo del caller.

### Frontend
- 11 archivos de admin-cms inyectan `organization_id: currentOrg.id` en inserts:
  BrandsTab, ContentTab (banners+gallery), FeaturedSectionsTab, HeroSlidesTab,
  LandingPagesTab (manual+duplicate+import), ModifiersTab (groups+options),
  PresentationsTab (form+import), ScriptsTab, ShippingTab.
- Guardia uniforme: si `currentOrg?.id` falta → toast "Selecciona una organización".

### Pendiente (Etapa 5)
- Reducir 322 MEDIUM del audit a 0: refinar regex para ignorar `.from().select().eq("organization_id"...)`.
- Migrar listas (SELECT) hacia `scopedFrom` cuando el componente ya tiene `currentOrg`.
- Sembrar tablas globales (`app_settings` global keys) con namespace por org.
