# Ola 6 — Slice F: Optimistic updates en CRUD admin (AC10)

Patrón aplicado: snapshot → setQueryData optimista → mutación → rollback en error.

## Cubierto
- `ProductsTab.tsx` — delete + toggleVisibility (key `["admin-products"]`).
- `BrandsTab.tsx` — del + toggleActive (key `["admin-brands", orgId]`; fix: key antes ignoraba orgId).
- `CategoriesTab.tsx` — deleteCategory + toggleActive (key `["admin-categories", orgId]`; mismo fix de scope).
- `PriceListsTab.tsx` — remove + toggleActive (key `["price-lists", orgId]`).
- `ModifiersTab.tsx` — deleteGroup/toggleGroupActive (key `["modifier-groups", selectedProduct, orgId]`) y deleteOption/toggleOptionActive (key `["modifier-options", expandedGroup, orgId]`).

Toggles y deletes reflejan cambio en <16ms sin esperar round-trip. En error: rollback al snapshot + toast.

## Pendiente
ContactsTab (asignación de price_list ya invalida); SortableList ya tenía optimistic reorder. Otros tabs no son alta frecuencia.
