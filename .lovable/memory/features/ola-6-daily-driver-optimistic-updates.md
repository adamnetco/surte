# Ola 6 — Slice F: Optimistic updates en CRUD admin (AC10)

Patrón aplicado: snapshot → setQueryData optimista → mutación → rollback en error.

- `ProductsTab.tsx` — delete + toggleVisibility (key `["admin-products"]`).
- `BrandsTab.tsx` — del + toggleActive (key `["admin-brands", orgId]`; fix: key antes ignoraba orgId y no actualizaba la UI).
- `CategoriesTab.tsx` — deleteCategory + toggleActive (key `["admin-categories", orgId]`; mismo fix de scope).

Toggles de visibilidad y eliminaciones ahora reflejan cambio en <16ms sin esperar round-trip. En error: rollback al snapshot + toast. Invalidación de la query pública (`products`/`categories`/`brands`) se hace al confirmar éxito.

Pendiente: PriceListsTab, ContactsTab, ModifiersTab — siguiente slice.
