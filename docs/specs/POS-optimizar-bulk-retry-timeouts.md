# POS — Optimizar Bulk Retry: timeouts y lotes

**Estado:** SHIPPED (AC1–AC5 entregados)
**Módulo:** edge `einvoice-resend` + `einvoice-resend-bulk-admin`
**Wave:** Follow-up de [POS-einvoice-retry-scoping](./POS-einvoice-retry-scoping.md) (observación #1)

## Problema

Hoy `retry_all_today` y `einvoice-resend-bulk-admin` ejecutan:
1. `SELECT` de pendientes del día (sin `LIMIT`).
2. `UPDATE ... IN (ids)` con todos los ids.
3. `INSERT` en `sync_outbox` con todas las filas.

Para una organización con >500 pendientes (caso real: caída prolongada de Innapsis), la consulta y los inserts pueden exceder el límite de 60s del edge runtime o saturar `sync_outbox`. Además, si el INSERT batch falla a la mitad, no hay reintento parcial: se pierde la operación completa.

## Outcomes

- [x] **AC1:** Procesar los pendientes en lotes de tamaño `BATCH_SIZE` (default 100, configurable vía body opcional `batch_size`). Implementado en `processBulkRetry` (`einvoice-resend-bulk-admin/index.ts`) con helper `chunk()`.
- [x] **AC2:** Por cada lote: `UPDATE ... IN (ids[lote])` + `INSERT outbox`. Si un lote falla, se registra en `sync_logs` con `phase='batch_N'` (`error_message='update_failed:…'` u `'outbox_insert_failed:…'`) y el bucle continúa con el siguiente.
- [x] **AC3:** Respuesta agregada incluye `batches: BatchResult[]` por org (`{ index, candidates, requeued, status, error? }`), `partial: boolean` por org y `partial: boolean` top-level. UI `EinvoiceBulkRetry.tsx` muestra badges por lote `L{i}: {requeued}/{candidates}` y banner "Ejecución parcial" cuando aplica.
- [x] **AC4:** Timeout guard wallclock (default 45s, configurable vía body `wallclock_ms` 1s–55s) + cursor `{ organization_id, last_processed_id }` para reanudar. Chequeo antes de cada org y antes de cada lote; si se agota presupuesto se setea `truncated=true`, `next_cursor`, se rompe el bucle y se registra `sync_logs` con `truncated=true` y `last_processed_id`. Query usa `ORDER BY id ASC` + `gt('id', cursor.last_processed_id)` cuando se reanuda dentro de la org del cursor. UI `EinvoiceBulkRetry.tsx` muestra banner amber con botón **Reanudar** que reenvía el body con `cursor`.
- [x] **AC5:** Tests `supabase/functions/einvoice-resend-bulk-admin/index_test.ts` — caso 250 pendings → 3 lotes (100/100/50), un único `sync_logs` agregado con `failed_batches=0`, plus tests de batch-failure parcial, all-fail, default batch_size, y 4 tests AC4 (wallclock corte entre lotes, cursor que salta orgs anteriores, corte antes de la siguiente org, BodySchema con `wallclock_ms`/`cursor`). **19/19 verde**.

## Notas

- No cambiar el contrato existente (org_id + dry_run siguen iguales). `batch_size`, `partial`, `batches`, `truncated`, `last_processed_id` son aditivos.
- El cursor de AC4 puede implementarse con `ORDER BY created_at ASC, id ASC` + `(created_at, id) > (cursor)`.
- Considerar mover el bulk a `pgmq` si los lotes >500 se vuelven recurrentes (fuera de scope acá).

## Riesgos

- Aumentar `batch_size` por encima de 200 puede disparar el límite de payload de PostgREST (~1MB). Documentar en el body schema.
- `truncated=true` exige que el cliente sepa reintentar; añadir handling en `EinvoiceShiftWidget` y `admin-cms/Facturacion` cuando se implemente.
