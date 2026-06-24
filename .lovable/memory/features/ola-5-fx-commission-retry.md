---
name: Ola 5 · Slice 3 — Reintentos automáticos comisión FX
description: pg_cron + edge function reintenta facturación de comisión FX fallida con backoff exponencial 1m→5m→30m→2h→12h.
type: feature
---

# Ola 5 · Slice 3 — Reintentos automáticos comisión FX

## Qué se entrega
- **Migración** `fx_transactions` añade:
  - `commission_invoice_retry_count int NOT NULL DEFAULT 0`
  - `commission_invoice_next_retry_at timestamptz`
  - `commission_invoice_last_error text`
  - Índice parcial `idx_fx_tx_commission_retry` (next_retry_at) WHERE status='failed'.
- **Edge** `fx-emit-commission-invoice` actualizada:
  - Acepta bearer `service_role` (skip user/membership check) → permite invocación desde cron.
  - Cualquier fallo persiste `commission_invoice_last_error` (≤1000 chars) + incrementa `retry_count` + setea `next_retry_at` con backoff `[1, 5, 30, 120, 720] min`. Tras 5 reintentos, `next_retry_at = NULL` (se rinde).
  - Éxito limpia `next_retry_at` y `last_error`. `skipped` (sin margen) también limpia.
- **Edge nueva** `fx-retry-commission-invoices`:
  - Escanea hasta 25 fx_transactions con `status='failed'`, `commission_amount>0`, `retry_count<5`, `next_retry_at IS NULL OR <= now()`.
  - Invoca `fx-emit-commission-invoice` por cada tx con bearer service-role.
  - Devuelve resumen `{scanned, succeeded, failed, results[]}`.
- **Cron** (`pg_cron`): job `fx-retry-commission-invoices` programado `*/10 * * * *`.
- **UI POS FX**: badge "FE err" ahora muestra `×N` con el conteo de reintentos y `title` con último error y próximo reintento (o "agotados" al llegar a 5).

## Decisiones
- Backoff exponencial corto al inicio para errores transitorios (token Innapsis, network) y luego espaciado para errores persistentes.
- 5 intentos máx (≈14h cubiertas). Después, requiere acción manual desde POS FX (botón "Reintentar factura" sigue funcionando — resetea el ciclo).
- El cron usa el anon key en el header `apikey` y `service_role` lo emite la edge interna al re-invocar `fx-emit-commission-invoice` (NO se hardcodea SERVICE en SQL).
- Las llamadas service-role omiten la verificación de membresía pero conservan el resto del flujo (sintético `pos_orders` + `innapsis-emit`), por lo que el comportamiento es idéntico al manual.

## Cierre Ola 5
- Slice 1 ✅ Cross-rate UIAF
- Slice 2 ✅ UIAF XML oficial
- Slice 3 ✅ Reintentos automáticos comisión
