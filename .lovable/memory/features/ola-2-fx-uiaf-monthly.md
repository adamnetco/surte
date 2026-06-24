---
name: Ola 2 — UIAF acumulado mensual por cliente
description: Slice 4 de Ola 2. Suma mensual de operaciones FX por documento contra el umbral UIAF; obliga captura de cliente aunque la operación individual sea menor.
type: feature
---

# Ola 2 · Slice 4 — UIAF mensual acumulado

## Qué se entrega
- **DB function** `public.fx_customer_monthly_accumulated(org, doc_number, month_start?)` SECURITY DEFINER, search_path=public, ejecutable solo por `authenticated` perteneciente a la organización.
  - Devuelve `(accumulated numeric, currency text, tx_count int, exceeds bool)` en la moneda del umbral UIAF de la organización (`organizations.uiaf_threshold_currency`, default USD/10000).
  - Suma `from_amount` si la divisa origen coincide con la moneda umbral, `to_amount` si coincide la destino, 0 en otro caso (no convierte cross-rates).
  - Devuelve early `(0, 'USD', 0, false)` si `doc_number` < 3 chars.
- **Índice** `idx_fx_tx_org_doc_created` parcial (`customer_doc_number NOT NULL`) para el lookup mensual.
- **Hook** `useFxCustomerMonthly(docNumber)` — query de 15s `staleTime`, deshabilitado < 3 chars o sin org.
- **UI POS FX**:
  - Mientras el cliente escribe el documento se consulta el acumulado.
  - Si `monthly.exceeds` o `accumulated + thresholdEquivalent ≥ threshold` (en la misma moneda), se fuerza `requiresCustomer` aunque la operación individual no supere el umbral.
  - Alert "Acumulado mensual UIAF superado" cuando el disparo es por mes (no por op individual), mostrando acumulado + proyección.
  - En el bloque de datos del cliente se muestra una pista `Mes: {acc} {ccy} · {n} op.` para contexto del cajero.

## Decisiones
- No convertimos cross-rates en SQL: si la operación está en una divisa distinta al umbral, no aporta al acumulado. Razón: evita depender de cotizaciones puntuales y posibles huecos. Si se requiere precisión cross-currency, se agrega en un slice posterior usando `fx_rates`.
- El acumulado se calcula por `customer_doc_number` exacto (btrim), no por `(doc_type, doc_number)`. Si en el futuro hay colisión NIT vs CC, se extiende la firma.
- La función es STABLE + SECURITY DEFINER con check de `organization_members` para que no filtre datos entre organizaciones.

## Próximo (cierre Ola 2)
- Reporte UIAF mensual agregado (`/casas-de-cambio/uiaf`) con clientes que cruzaron umbral durante el mes.
- Export plano UIAF reusa `buildUiafCsv` ya existente.
