# Reporte de Revisión — POS-innapsis-emision-pos

**Fecha:** 2026-06-24
**Resultado general:** ✅ APROBADO CON OBSERVACIONES

## Criterios de Aceptación

| AC | Estado | Detalle |
|----|--------|---------|
| AC1 | ✅ | `DocumentTypeSelector` integrado en `PaymentDialog.tsx:113` con catálogo dinámico `useOrgDocumentTypes`. Reemplaza el enum corto del spec por catálogo extensible (`document_types` + `organization_document_types`) — mejora arquitectónica. |
| AC2 | ✅ | Auto-sugerencia por NIT implementada en `DocumentTypeSelector` (lógica `customerHasNit`). |
| AC3 | ✅ | `pos_orders.einvoice_doc_type` persistido vía `POSWorkspace.tsx:357` (`einvoice_doc_type: meta.docType ?? 'pos_electronico'`). Schema en migración `20260624033122`. |
| AC4 | ✅ | `EinvoiceStatusBadge` montado en `SaleCompleteDialog.tsx:98`. Estados queued/sending/accepted/rejected/contingency cubiertos. |
| AC5 | ✅ | `useEinvoiceLiveStatus` suscribe a `electronic_invoices` filtrado por `pos_order_id` (Realtime). |
| AC6 | ✅ | Badge usa fallback "Procesando en segundo plano" cuando no hay update tras timeout. |
| AC7 | ✅ | `EinvoiceActions` con botones Imprimir / Ver / Email / WhatsApp en `SaleCompleteDialog.tsx:113`. |
| AC8 | ✅ | `InvoicePdfDrawer` lateral con PDF iframe + descarga XML/QR/PDF. |
| AC9 | ✅ | `einvoice-resend` action `retry_now` con guard `isAdmin`, bypass de backoff (`retry_count=0, next_retry_at=null`). |
| AC10 | ✅ | `DianHealthIndicator` en topbar; `dian-health-check` edge function cron 5min; `dian_health_status` columna con CHECK. |
| AC11 | ✅ | `innapsis-emit` rama contingencia (`is_contingency=true`, `status='contingency'`, `contingency_emitted_at`). `ContingencyBanner` en POS. |
| AC12 | ✅ | `einvoice-contingency-flush` cron 2min; índice parcial `idx_einvoices_contingency_pending`; service-role short-circuit + throttle 300ms/org, batch 25. |
| AC13 | ✅ | Tab "Comportamiento POS" en `/admin/facturacion` con `POSBehaviorSettings` (default_doc_type, ask_on_each_sale, auto_send_email, auto_send_whatsapp) → `einvoice_configs.pos_behavior`. |
| AC14 | ✅ | `ResolutionStatusBanner` en `POSWorkspace.tsx:502` con estados missing/exhausted/near_limit/inactive vía `useEinvoiceResolutionStatus` (Realtime). |
| AC15 | ✅ | `EinvoiceShiftWidget` en topbar POS con conteo ok/retry/err Realtime + popover + acción `retry_all_today`. |

## Gaps críticos (bloquean aprobación)

Ninguno.

## Observaciones (no bloquean — abrir spec follow-up)

1. **Decisión pendiente #1 del spec:** Política "bloquear cobro si DIAN offline sin contingencia" aún no implementada como bloqueo duro — actualmente solo banner. Recomendado abrir mini-spec `POS-einvoice-hard-block-policy`.
2. **Decisión pendiente #2:** Default doc type por `business_type` (HORECA/B2B/Casa de Cambio) no automatizado; hoy se elige manualmente desde el tab de configuración.
3. **AC11 — campo XML `Contingencia=true`:** queda marcado en spec como "campo final a confirmar con Innapsis". Verificar con el equipo de Innapsis y actualizar `innapsis-emit` si el nombre/path difiere.
4. **`retry_all_today`** opera sobre todas las orgs donde el caller es admin; si un superadmin invoca, puede impactar múltiples tenants. Considerar parámetro explícito `organization_id` para confinar el scope.
5. **Sin tests E2E** (Playwright/Vitest) para el flujo cobro → badge en vivo → acción rápida. Recomendado smoke test antes de habilitar para tenants productivos.

## Acciones

- Estado del spec → **SHIPPED**.
- Abrir specs follow-up para observaciones 1, 2, 4.
- Coordinar con Innapsis para confirmar observación 3 antes de habilitar contingencia en producción.
