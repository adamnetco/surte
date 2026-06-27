# Ola 7 — Reportes & Analítica POS

**Objetivo:** Dashboard de ventas robusto y exportable que compita con Vendty/Loyverse/Alegra. Mobile-first, scoped por organization, sin tablas anchas.

Cada slice se entrega completo en su propio turno. Verificación = typecheck verde + screenshot Playwright.

---

## Slice 1 — Backend de agregación (RPC + índices)

Crear una sola fuente de verdad para los reportes.

**Migración:**
- `report_sales_summary(org_id uuid, from_date date, to_date date, granularity text)` → SECURITY DEFINER, devuelve `bucket, gross, net, tax, discount, refunds, tickets, units`. Granularity: `hour|day|week|month`.
- `report_top_products(org_id, from, to, limit)` → top N por `units` y `gross`, con `product_id, name, sku, units, gross, margin_pct`.
- `report_payment_mix(org_id, from, to)` → suma por método.
- `report_cashier_performance(org_id, from, to)` → por `cashier_id`: tickets, gross, avg_ticket.
- Índices: `idx_pos_orders_org_closed_at`, `idx_pos_order_items_order` (si no existen).
- GRANT EXECUTE a `authenticated` + check `has_org_access(org_id)` dentro.

---

## Slice 2 — Página `/admin/reportes` (KPIs + gráficos)

**Layout mobile-first:**
- Header: range picker (Hoy / 7d / 30d / Mes / Custom) + comparador (vs período anterior).
- 4 KPI cards: Ventas netas, Tickets, Ticket promedio, Margen. Cada uno con delta % vs período anterior + sparkline.
- Gráfico principal: serie temporal (recharts) con toggle gross/net/units.
- Skeleton presets durante carga.
- Hook `useSalesReport({ from, to, granularity })` con React Query, key `["report-sales", orgId, from, to, granularity]`.

---

## Slice 3 — Vertical cards de detalle

Tres secciones tipo card-stack (NO tablas anchas):
- **Top productos** — card por producto con nombre, sku, units, gross, barra de progreso del % sobre total.
- **Mix de pagos** — donut + leyenda con %.
- **Performance por cajero** — card por cajero con avatar, tickets, gross, avg.

Cada card es tap-target ≥56px en mobile. En desktop, grid de 3 columnas.

---

## Slice 4 — Exportación CSV / XLSX

- Botón "Exportar" en header con menú: CSV (rápido) / XLSX (con formato).
- CSV client-side con `Papa.unparse`.
- XLSX con `xlsx` lib (ya en deps si no, `bun add xlsx`). Hojas: Resumen, Productos, Pagos, Cajeros.
- Filename: `sistecpos-reporte-{orgSlug}-{from}-{to}.xlsx`.
- Toast con progreso si > 1000 filas.

---

## Slice 5 — Comparativas + persistencia + QA

- Toggle "Comparar con período anterior" persiste en localStorage por org.
- Saved views: usuario guarda combinaciones (rango + granularity + comparador) en `app_settings.user_report_views`.
- Atajo Cmd+K: "Ir a Reportes" + búsqueda "ventas hoy/ayer/semana".
- Playwright E2E: range picker → KPIs cargan → export descarga archivo.
- Typecheck verde, security scan, publish a producción.

---

## Decisiones técnicas

- **Sin recharts nuevo**: ya está en el stack (`src/components/ui/chart.tsx`).
- **Sin tablas legacy**: solo vertical cards.
- **Realtime opcional**: por ahora pull-on-focus; realtime para "Hoy" en slice futuro si lo pides.
- **No tocar pos_orders schema**: todas las agregaciones se hacen en RPC sobre lo que ya existe.

---

¿Apruebo el plan y arranco **Slice 1 (RPCs + índices)** en el siguiente turno?
