---
name: Ola 2 FX Margin Report (slice 3)
description: Reporte agregado de margen FX por par/cajero/día en /casas-de-cambio/reportes
type: feature
---

# Reporte de margen FX agregado

Slice 3 de Ola 2. Extiende `/casas-de-cambio/reportes` con vista agregada del margen capturado por las operaciones FX.

## Cambios
- `useFxReports.useFxSummary`: ahora devuelve `byPair`, `byCashier`, `byDay` (tipo `MarginBucket`) y `totals.totalMargin` + `totals.marginCurrencyId`. Cada bucket cuenta `count`, `margin`, y desglose por estado de facturación electrónica (`invoiced` = `emitted`, `pending` = margen>0 sin emitir, `failed`).
- `FxReportsPage`:
  - KPI extra **Margen total** (emerald) en la grilla superior (ahora 5 columnas en desktop).
  - 3 tarjetas nuevas `MarginCard` (Coins/Users/CalendarDays) con top 10 por margen.
  - Resuelve nombres de cajero via `profiles.full_name` por `id` con un `useEffect` que se dispara cuando cambia el set de IDs visibles.
  - Pares mostrados como `FROM → TO` usando códigos ISO.

## Reusa
- `commission_amount`, `commission_currency_id`, `commission_invoice_status` agregados en slice 1.
- Mantiene rango mensual existente (selector mes/año, `monthRange`).
- No requiere migración nueva ni edge function.

## Pendiente (post-Ola 2)
- Filtro por cajero/par dentro del rango.
- Exportar CSV específico de márgenes (hoy el CSV `FX-operaciones` ya incluye todas las columnas).
- Gráfica sparkline por día.
