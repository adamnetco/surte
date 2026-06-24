---
name: Ola 2 — FX commission invoice (slice 2)
description: Edge function fx-emit-commission-invoice + botón "Facturar comisión" en POS FX. Reusa innapsis-emit, contingencia y email PDF/XML de Ola 1.
type: feature
---

# Ola 2 · Slice 2 — Facturación electrónica de la comisión FX

## Qué se entrega
- **Edge function** `fx-emit-commission-invoice`:
  - Valida JWT del caller + membresía en `organization_members` (no permite cross-org).
  - Idempotente: si `commission_invoice_status='emitted'` y ya tiene `electronic_invoice_id`, devuelve `already_emitted:true` sin crear nada.
  - Si `commission_amount <= 0` → marca `skipped` y termina.
  - Si falta `location_id` o `cash_session_id` en la fx_tx → `failed` con `fx_tx_missing_session_or_location` (la operación se hizo fuera de sesión de caja).
  - Pasa a `queued`, crea un `pos_orders` sintético (`sale_mode='fx_commission'`, `status='completed'`, `metadata.fx_transaction_id`) + 1 `pos_order_items` ("Comisión cambio de divisas", IVA 0) + 1 `pos_payments` cash, y delega en **`innapsis-emit`** con el bearer del caller.
  - Persiste el resultado en `fx_transactions`:
    - éxito normal → `commission_invoice_status='emitted'` + `electronic_invoice_id`.
    - contingencia DIAN → se mantiene `queued` (la transmisión la cierra `einvoice-contingency-flush`).
    - error Innapsis → `failed` y devuelve el detalle al cliente.
- **Hook** `useEmitFxCommissionInvoice` (`src/modules/fx/hooks/useFxTransactions.ts`):
  - Invoca la edge vía `supabase.functions.invoke`.
  - Toasts diferenciados (éxito, contingencia con número, sin margen, ya facturada, sesión faltante).
  - Invalida `fx_transactions_recent` al terminar.
- **UI POS FX** (`PosFxPage.tsx`, lista "Últimas operaciones"):
  - Botón **"Facturar comisión"** sólo cuando `commission_amount > 0` y status ∈ {`pending`,`failed`}; en `failed` el botón es `destructive` con label "Reintentar factura".
  - Spinner por fila usando `mutation.variables` para no bloquear toda la lista.
  - Badges ampliados: `FE` (emitted), `FE…` (queued/contingencia), `FE err` (failed), `s/margen` (skipped).

## Decisiones
- **Reusar `innapsis-emit` vía pos_order sintético** en vez de duplicar la lógica de XML / numeración / contingencia / DV / token cache. Coste: dos inserts adicionales por factura. Beneficio: una sola superficie DIAN, contingencia y email PDF/XML "gratis" desde Ola 1.
- `sale_mode='fx_commission'` queda como discriminador para reportes — no se mezcla con ventas POS normales.
- El bearer del usuario se propaga a `innapsis-emit` para que `created_by`/`performed_by` queden trazados (no se usa service-role para evitar bypass de membresía).
- No se reintenta automáticamente en `failed` — el operador decide desde la UI (reintento manual con el mismo botón).

## Próximos slices
3. Reporte agregado de margen por par/cajero/día en `/casas-de-cambio/reportes` (extender vista existente con totales de comisión emitida vs pendiente).
4. Validación UIAF agregada mensual (>USD10K acumulado por cliente) — extender `fx_fraud_rules`.
5. Cron opcional `fx-commission-autoflush` que facture todo lo pending del día al cierre de caja.
