---
name: Ola 5 · Slice 1 — UIAF cross-rate
description: Acumulado mensual UIAF ahora convierte cross-rate vía fx_rates publicado cuando ninguna divisa del par coincide con la moneda del umbral.
type: feature
---

# Ola 5 · Slice 1 — Cross-rate UIAF

## Qué se entrega
- **DB function** `public.fx_convert_to_currency(org, amount, from_currency_id, to_code, at)` SECURITY DEFINER, STABLE. Devuelve el monto convertido usando la última cotización publicada (`fx_rates.is_published = true`, `effective_at <= at`) del par directo (`base=from, quote=to` → multiplica) o inverso (`base=to, quote=from` → divide). Usa `base_rate`, fallback `(buy+sell)/2`. Devuelve `NULL` si no hay cotización aplicable.
- **DB function** `fx_customer_monthly_accumulated` recreada con dos columnas nuevas:
  - `cross_count`: operaciones del mes cuya divisa no es la del umbral y se convirtieron vía `fx_convert_to_currency`.
  - `missing_rate_count`: operaciones cross que no se pudieron valorar (no contabilizadas en `accumulated`).
  - El SUM ahora incluye también los cross-rate convertidos (antes los ignoraba).
- **Hook** `useFxCustomerMonthly` expone `crossCount` y `missingRateCount`.
- **POS FX (`PosFxPage`)** añade en la pista "Mes:" el conteo de cross-rate y una nota ámbar cuando hay operaciones sin cotización publicada (no contadas).

## Decisiones
- Cotización al momento de la transacción (`t.created_at`), no la más reciente — preserva el valor que se reflejó esa operación.
- Sólo cotizaciones publicadas; las en borrador no afectan el acumulado UIAF.
- Mantenemos `customer_doc_number` como pivote (igual que Slice 4 de Ola 2).
- Cambio de firma (columnas nuevas en RETURNS TABLE): requirió `DROP FUNCTION` previo. El hook lee por nombre de campo, así que el cambio es backward-compatible para el cliente.

## Pendiente (próximos slices Ola 5)
- Slice 2: Reporte UIAF oficial XML.
- Slice 3: Reintentos automáticos de facturación de comisión fallida.
