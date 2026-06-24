---
name: Ola 2 — FX spread y comisión transaccional
description: Cálculo, persistencia y visualización del spread/comisión por operación FX. Primer slice de la Ola 2 transaccional.
type: feature
---

# Ola 2 · Slice 1 — Spread y margen por operación FX

## Qué se entrega
- **Schema** `fx_transactions`: nuevas columnas
  - `mid_rate numeric` — tasa media `(buy + sell) / 2` al momento de la operación.
  - `commission_amount numeric` — margen implícito a favor de la casa, expresado en la divisa quote.
  - `commission_currency_id uuid → fx_currencies(id)` — la divisa en la que se expresa el margen (normalmente la quote del par).
  - `commission_invoice_status text` — máquina de estados: `pending | queued | emitted | failed | skipped`.
  - Índice parcial `idx_fx_tx_commission_status` para la cola de facturación pendiente.
- **UI POS FX** (`/pos/fx`):
  - Muestra **media** y **spread** del par junto a las tasas de compra/venta.
  - Bloque "Margen estimado" verde que aparece cuando hay monto > 0; usa la fórmula
    `units_base × |rate_applied − mid_rate|`.
  - Persiste `mid_rate`, `commission_amount` y `commission_currency_id` al crear la operación.
  - Lista "Últimas operaciones" muestra el margen y un badge `FE` / `FE err` según `commission_invoice_status`.
- **Hook** `useCreateFxTransaction` acepta los tres campos nuevos como opcionales.

## Decisiones
- El margen se calcula contra la **tasa media** (no contra una tabla de costos), porque es la única señal objetiva disponible con los datos actuales. Sirve como base imponible para la factura electrónica de comisión.
- `commission_invoice_status` arranca en `pending` y NO se factura automáticamente: el siguiente slice añade el botón "Facturar comisión" y la edge function que delega en `innapsis-emit`.
- No se toca la lógica de UIAF, anti-fraude ni cierre de caja multi-divisa — ya existían en slices previos de FX.

## Próximos slices de Ola 2
1. Edge function `fx-emit-commission-invoice` que crea una `pos_orders` sintética con un único ítem "Comisión cambio de divisas" y llama a `innapsis-emit` (reusa contingencia + email PDF/XML de la Ola 1).
2. Botón "Facturar comisión" en la lista de últimas operaciones y en el detalle de la transacción.
3. Reporte agregado de margen por par/cajero/día en `/casas-de-cambio/reportes`.
4. Validación UIAF agregada mensual (>USD10K acumulado por cliente) — extender `fx_fraud_rules`.
