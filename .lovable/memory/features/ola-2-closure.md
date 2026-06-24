---
name: Ola 2 — FX transaccional (cierre)
description: Resumen de los slices 1-5 entregados en Ola 2 (FX transaccional) y estado de cierre.
type: feature
---

# Ola 2 — FX transaccional · Cierre

Slices entregados:

1. **Slice 1 — Spread/margen por operación**: cálculo automático de `commission_amount` y `commission_currency_id` al crear `fx_transactions`, exposición en POS FX y hook `useFxTransactions`.
2. **Slice 2 — Facturación de comisión**: edge function `fx-emit-commission-invoice` idempotente, crea `pos_orders` sintético (`sale_mode='fx_commission'`) y delega en `innapsis-emit`. Botón "Facturar comisión" + badges FE/FE…/FE err/s/margen en POS FX.
3. **Slice 3 — Reporte de margen agregado**: `useFxSummary` extendido con `byPair`, `byCashier`, `byDay` + KPI "Margen total" y tres `MarginCard` en `/casas-de-cambio/reportes`.
4. **Slice 4 — Acumulado mensual UIAF por cliente (POS)**: SQL `fx_customer_monthly_accumulated` (SECURITY DEFINER) + hook `useFxCustomerMonthly` + alerta en POS FX cuando el acumulado del mes + operación actual cruza el umbral.
5. **Slice 5 — Acumulado mensual UIAF por cliente (Reportes)**: bloque en `FxReportsPage` con conteo de clientes sobre umbral / cerca del umbral (≥80%) y listado top 50 con badges UIAF/ROS. Agregación cliente-side sobre `txs` ya cargadas, sumando solo importes cuya divisa origen o destino coincide con la moneda del umbral.

Pendiente conocido (fuera de Ola 2):
- Conversión cross-rate vía `fx_rates` para acumulados cuando ninguna divisa del par coincide con la moneda del umbral. Hoy se ignora ese tramo (mismo comportamiento que la función SQL).
- Reporte UIAF oficial XML (hoy solo CSV plano).
- Reintentos automáticos de facturación de comisión fallida (hoy se reintenta manualmente desde POS FX).

Ola 2 cerrada. Próxima ola: Innapsis DIAN (Ola 3) o Daily Driver UX según prioridad de roadmap.
