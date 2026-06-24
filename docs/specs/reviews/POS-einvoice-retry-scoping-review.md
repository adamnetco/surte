# Reporte de Revisión — POS-einvoice-retry-scoping

**Fecha:** 2026-06-24
**Resultado general:** ⚠️ APROBADO CON OBSERVACIONES

## Criterios de Aceptación

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — `BodySchema` + 400 si falta `organization_id` | ✅ | `einvoice-resend/index.ts:18-24` (schema) + `:62-66` (guard). |
| AC2 — Validar rol del caller en esa org | ✅ | `:67-77` — `SELECT role FROM organization_members WHERE org=? AND user=?`; 403 si no `owner/admin/superadmin`. |
| AC3 — Widget envía `organization_id` | ✅ | `EinvoiceShiftWidget.tsx:48-50`. |
| AC4 — Auditoría en `sync_logs` | ✅ | `:103-114` — `service_name='einvoice_bulk_retry'`, `payload={action, requeued_count, requested_by, since}`, `organization_id` correcto. |
| AC5 — Endpoint admin separado para multi-org | ⚠️ | Documentado como follow-up fuera de scope. Riesgo principal neutralizado por AC1+AC2. |

## Gaps críticos
Ninguno.

## Observaciones (resueltas)

1. ✅ **Batch UPDATE + INSERT** — un solo `UPDATE ... IN (ids)` y un solo `INSERT` con array de rows, en lugar del loop secuencial. Elimina riesgo de timeout para turnos con >50 pendientes.
2. ✅ **`dry_run` implementado** — body acepta `dry_run: boolean`; retorna `{ candidates }` sin mutar. Widget hace preview + `window.confirm("Se reencolarán N documentos") ` antes de ejecutar.
3. ✅ **Auditoría de fallas** — fallas de query/update/insert se loguean en `sync_logs` con `status='error'` y `error_message`; el éxito sigue siendo logueado.
4. ✅ **AC5 movido a spec propio** — `docs/specs/POS-einvoice-bulk-retry-admin.md` (DRAFT).
5. ✅ **Tests unit añadidos** — `EinvoiceShiftWidget.test.tsx` 3/3: (a) envía `organization_id` en dry_run y commit, (b) aborta si candidates=0, (c) respeta cancelación del confirm.
6. ⚠️ **Mensaje 400 cambiado** — aceptado: único consumer (`EinvoiceShiftWidget`) actualizado en el mismo cambio.

## Acción
- Spec **SHIPPED**, todas las observaciones cerradas.
- Edge function `einvoice-resend` redeployada.

