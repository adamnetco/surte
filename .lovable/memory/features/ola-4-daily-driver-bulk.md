---
name: Ola 4 Slice 1 — Bulk actions Daily Driver
description: Sheet bottom con selección múltiple para reintentar facturas DIAN y confirmar pedidos pendientes desde /admin/diario
type: feature
---
**Ola 4 — Slice 1 (Daily Driver UX)**

`DiarioBulkSheet.tsx` (nuevo) — Sheet mobile-first (h-[85dvh], bottom, max-w-2xl en sm+):
- Kind `einvoice`: lista top 50 `electronic_invoices` con status in (error, dead_letter, rejected) en 24h. Bulk = loop `einvoice-resend` `action: retry_now` (5 concurrentes). CTA extra "Reintentar todos hoy" → `action: retry_all_today` con `organization_id`.
- Kind `pending`: lista top 50 `orders` con status='pendiente'. Bulk = UPDATE `status='confirmado'` en lote.
- Selección múltiple con checkbox indeterminate, select-all, contador, toast sonner con resultados.
- Invalida cache `["admin","diario",orgId]` tras ejecución para refrescar KPIs.

`Diario.tsx`:
- `ActionCard` ahora acepta `bulkLabel` + `onBulk`. Si se pasa, renderiza botón secundario "Reintentar"/"Confirmar" con icono Zap; el resto del card mantiene navegación normal.
- `ActionEntry.bulkKind?: 'einvoice' | 'pending'` se setea sólo en las entradas que tienen primitiva bulk.
- Sheet montado a nivel página con `bulkKind` state.

No tocó RLS/migraciones — usa EFs existentes (`einvoice-resend`) y UPDATE directo sobre `orders` (RLS ya cubre owner/admin).
