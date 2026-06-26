---
name: Ola 6 Slice C — Productos recientes en POS
description: Strip horizontal de productos recientes (últimos 8 añadidos) por organización en el POSWorkspace, persistido en localStorage
type: feature
---
# Ola 6 Slice C — Recent products quick-access

`src/modules/pos/hooks/useRecentProducts.ts` (nuevo) — Hook scoped por `organizationId`. Guarda hasta 8 product IDs en `localStorage["sistecpos:pos:recent:<orgId>"]`. API: `{ recent, push, clear }`.

`src/modules/pos/components/POSWorkspace.tsx`:
- `addProduct` ahora llama `pushRecent(p.id)` antes de mutar el ticket.
- Strip horizontal renderizado sobre el grid del catálogo cuando `recentProducts.length > 0 && !loading`. Cards de 112px con imagen, nombre clampeado y precio. Click reusa `addProduct`.
- `recentProducts` resuelto vía `useMemo` cruzando IDs con `products` cargados; productos eliminados del catálogo se filtran solos.

Sin migraciones, sin RLS. Cubre AC6 del spec `docs/specs/POS-daily-driver-ux.md`.
