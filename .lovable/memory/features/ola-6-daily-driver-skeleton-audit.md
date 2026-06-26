# Ola 6 — Slice E: Skeleton audit (AC9)

Reemplazo de spinners genéricos por skeletons con forma del contenido en listas admin:

- `CustomerReviewsTab.tsx` — 3 skeleton cards (avatar + meta + texto).
- `GoogleReviewsTab.tsx` — 3 skeleton cards igual estructura.
- `CrmLeadsTab.tsx` — grid 4 cards con header, badge, links y fecha.
- `MembersAuditTab.tsx` — header + 4 filas (avatar + nombre + rol badge).

Todos con `aria-busy="true"` y `aria-label` descriptivo. Otros tabs (Products, Organizations, PriceLists, Contacts, Innapsis*, SyncStatusPanel) ya tenían skeleton.

Pendiente: SuperadminUsers, hostgs, electron logs — fuera de Daily Driver.
