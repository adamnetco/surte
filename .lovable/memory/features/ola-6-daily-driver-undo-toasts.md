---
name: Ola 6 Slice H — Undo toasts en CRUD admin
description: Hook useUndoableDelete (optimista + "Deshacer" 5s) reemplaza window.confirm en Brands/Categories/PriceLists. Snapshot del cache, remove inmediato, commit en setTimeout, cancelación restaura cache sin round-trip.
type: feature
---

# Ola 6 — Slice H (AC11)

Hook: `src/modules/admin-cms/hooks/useUndoableDelete.ts`.

Reemplaza `window.confirm("¿Eliminar...?")` por un toast con acción **Deshacer** (5s).
Cache se actualiza optimistamente; el DELETE real se ejecuta cuando vence el timer.
Si el usuario hace Undo: clearTimeout + restaura snapshot + toast.info.

## Wired
- `BrandsTab.tsx` — table `brands`, invalida `["brands"]` al commit.
- `CategoriesTab.tsx` — table `categories`, invalida `["categories"]` al commit.
- `PriceListsTab.tsx` — table `price_lists`.
- `ProductsTab.tsx` — table `products`, `matchOnDelete: { organization_id }`, invalida `["products"]`.
- `ModifiersTab.tsx` — `modifier_groups` + `modifier_options`.
- `HeroSlidesTab.tsx` — table `hero_slides`, invalida `["hero_slides","admin-hero-slides"]`.
- `CouponsTab.tsx` — table `coupons`, scoped por `organization_id`.
- `LandingPagesTab.tsx` — table `landing_pages`, scoped por `organization_id`.
- `ContentTab.tsx` — banners, testimonials y gallery (3 secciones), todas scoped por `organization_id`.

Hook ahora acepta `matchOnDelete` (filtros `.eq()` extra para scoping por org).

## Pendiente para próxima iteración
SeoContentTab; resto de tabs son baja frecuencia.
