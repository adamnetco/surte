# Reporte de Revisión — POS-einvoice-retry-scoping

**Fecha:** 2026-06-24
**Resultado general:** ❌ RECHAZADO — feature aún no implementado

> ⚠️ El spec figura como **DRAFT**. La skill `/POS-review` exige estado `IN_BUILD` o `IN_REVIEW`. Se ejecuta este reporte para dejar constancia del baseline antes de implementarlo en `/pos-feature`.

## Criterios de Aceptación

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — `BodySchema` requiere `organization_id` para `retry_all_today` | ❌ | `supabase/functions/einvoice-resend/index.ts:18-22` — `BodySchema` solo tiene `invoice_id?`, `action`, `to?`. Falta `organization_id`. |
| AC2 — Validar rol del caller en la `organization_id` solicitada | ❌ | Líneas 60-69 — el handler toma **todos** los memberships admin del usuario, no valida contra una org específica. Multi-tenant cross-contamination. |
| AC3 — `EinvoiceShiftWidget` envía `organization_id` explícito | ❌ | `EinvoiceShiftWidget.tsx:48-49` — body es `{ action: "retry_all_today" }`, sin `organization_id`. |
| AC4 — Auditoría a `sync_logs` con metadata `{org, requeued_count, requested_by}` | ❌ | Líneas 79-93 — solo retorna `{ success, requeued }`. No hay INSERT a `sync_logs`. |
| AC5 — Endpoint admin separado para retry global multi-org | ❌ | No existe; el endpoint actual ya hace de facto multi-org sin scoping, lo cual es el problema raíz. |

## Gaps críticos (bloquean aprobación)

1. **Riesgo activo en producción**: cualquier superadmin con membership en N orgs que dispare retry_all_today desde el POS de la org A requeueará pendientes de las orgs B…N. Confirmar si hay superadmins multi-org en Live antes de tocar.
2. **Schema breaking**: el cambio en `BodySchema` (campo nuevo obligatorio) requiere coordinar deploy de la edge function + frontend en el mismo PR. Cualquier cliente desfasado romperá con 400.
3. **No hay tests E2E** que cubran el flujo widget→edge→requeue.

## Recomendación

Pasar el spec a **IN_BUILD** y ejecutar `/pos-feature POS-einvoice-retry-scoping`. Implementación sugerida:

1. Edge: añadir `organization_id: z.string().uuid()` cuando `action='retry_all_today'` (usar `z.discriminatedUnion` o `superRefine`).
2. Edge: validar membership con `SELECT 1 FROM organization_members WHERE user_id=$1 AND organization_id=$2 AND role IN ('owner','admin','superadmin')`; si no → 403.
3. Edge: filtrar `electronic_invoices` por la `organization_id` recibida (no por `IN (orgIds)`).
4. Edge: `INSERT INTO sync_logs (organization_id, service_name='einvoice_bulk_retry', status='success', payload={requeued, requested_by, action})`.
5. Frontend: `EinvoiceShiftWidget.tsx` envía `{ action, organization_id: currentOrganization.id }`.
6. (AC5 opcional) Endpoint admin `einvoice-resend-bulk-admin` para superadmin con scope multi-org explícito.

## Acción
- Spec mantiene estado **DRAFT** (no cumple criterios para SHIPPED).
- Próximo paso: `/pos-feature POS-einvoice-retry-scoping`.
