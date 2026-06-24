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

## Observaciones (no bloquean)

1. **Loop secuencial en bulk** — `for (const row of pendings)` hace 2 awaits por factura (UPDATE + INSERT outbox). Para turnos con >50 pendientes la latencia puede pasar el timeout de la edge (60s). Considerar batch INSERT a `sync_outbox` y `UPDATE ... WHERE id = ANY($1)` para reducir round-trips.
2. **Sin `dry_run`** — la nota original del spec sugería `dry_run: boolean` para preview. No se implementó. Útil para UX cuando hay decenas de pendientes.
3. **No se registra falla** — si `pendings` viene `null` por error de Supabase, el handler retorna `requeued: 0` sin log. Considerar `sync_logs` con `status='error'` cuando la query falla.
4. **AC5 sin spec propio** — recomendado crear `POS-einvoice-bulk-retry-admin.md` (DRAFT) para no perder el follow-up.
5. **Sin test E2E ni unit** — el cambio es seguridad-crítico; un test que confirme `403` cuando el caller no es admin de la org sería deseable. Bloqueado por mocks de edge function (no existe harness en repo).
6. **Mensaje 400 cambiado** — clientes externos que reusen este endpoint (no hay hoy) romperán. Mitigación: solo `EinvoiceShiftWidget` lo consume y se actualizó en el mismo cambio.

## Acción
- Spec actualizado a **SHIPPED**.
- Observaciones 1 y 2 candidatas a follow-up corto si aparece queja de performance.
- Observación 4 (AC5) requiere su propio spec cuando surja el caso de uso superadmin.
