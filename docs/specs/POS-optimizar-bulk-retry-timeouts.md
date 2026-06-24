# POS — Optimizar Bulk Retry: timeouts y lotes

**Estado:** IN_REVIEW (AC1/AC2/AC3/AC5 entregados — AC4 wallclock pendiente)
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
- [ ] **AC4:** Timeout guard wallclock (>45s) + cursor `last_processed_id` → **pendiente** (chunk separado por ser invasivo: cambia el shape del response con `truncated`/cursor y exige handling de reintento en cliente).
- [x] **AC5:** Tests `supabase/functions/einvoice-resend-bulk-admin/index_test.ts` — caso 250 pendings → 3 lotes (100/100/50), un único `sync_logs` agregado con `failed_batches=0`, plus tests de batch-failure parcial, all-fail y default batch_size. **15/15 verde**.

## Notas

- No cambiar el contrato existente (org_id + dry_run siguen iguales). `batch_size`, `partial`, `batches`, `truncated`, `last_processed_id` son aditivos.
- El cursor de AC4 puede implementarse con `ORDER BY created_at ASC, id ASC` + `(created_at, id) > (cursor)`.
- Considerar mover el bulk a `pgmq` si los lotes >500 se vuelven recurrentes (fuera de scope acá).

## Riesgos

- Aumentar `batch_size` por encima de 200 puede disparar el límite de payload de PostgREST (~1MB). Documentar en el body schema.
- `truncated=true` exige que el cliente sepa reintentar; añadir handling en `EinvoiceShiftWidget` y `admin-cms/Facturacion` cuando se implemente.
