---
name: Ola 1 — Cierre Innapsis legal
description: Cierre Ola 1 del Standup 2026-06-24 (contingencia DIAN ya operando + auto-email PDF/XML + reporte agregado)
type: feature
---

## Entregables Ola 1 (cerrada 2026-06-24)

1. **Contingencia DIAN** — ya operativa antes de la ola:
   - `einvoice-contingency-flush` (cron 2 min, FIFO, max 25/run, throttle 300ms por org).
   - `is_contingency` + `transmitted_at` en `electronic_invoices` indican estado.
   - Modo offline visible en POS vía `dian_health_status`.

2. **Auto-email PDF/XML al emitir** — `innapsis-emit/index.ts`:
   - Tras `res.ok` y NO retransmisión de contingencia, dispara fire-and-forget a `einvoice-resend` action `send_email`.
   - Usa `payload.Fe.Receptor.Email` con validación regex mínima.
   - Falla silenciosa no rompe la emisión; queda log en `email_send_log`.

3. **Reporte agregado** — `/admin/innapsis/resumen` (`InnapsisResumen.tsx`):
   - Rangos: hoy, 7d, 30d, 90d.
   - Stats: aceptadas / rechazadas / pendientes / contingencia (count + suma COP).
   - Export CSV de las filas del rango (hasta 5000).
   - Refetch 30s; link desde header de `/admin/innapsis`.

## Reglas que siguen vigentes
- Ola 2 (FX transaccional) puede arrancar; factura comisión usa `innapsis-emit` ya cerrado.
- Para reabrir contingencia hay que tocar `einvoice-contingency-flush`, no el emisor.
