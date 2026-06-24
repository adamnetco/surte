# POS — Optimizar Bulk Retry: timeouts y lotes

**Estado:** DRAFT
**Módulo:** edge `einvoice-resend` + `einvoice-resend-bulk-admin`
**Wave:** Follow-up de [POS-einvoice-retry-scoping](./POS-einvoice-retry-scoping.md) (observación #1)

## Problema

Hoy `retry_all_today` y `einvoice-resend-bulk-admin` ejecutan:
1. `SELECT` de pendientes del día (sin `LIMIT`).
2. `UPDATE ... IN (ids)` con todos los ids.
3. `INSERT` en `sync_outbox` con todas las filas.

Para una organización con >500 pendientes (caso real: caída prolongada de Innapsis), la consulta y los inserts pueden exceder el límite de 60s del edge runtime o saturar `sync_outbox`. Además, si el INSERT batch falla a la mitad, no hay reintento parcial: se pierde la operación completa.

## Outcomes

- [ ] **AC1:** Procesar los pendientes en lotes de tamaño `BATCH_SIZE` (default 100, configurable vía body opcional `batch_size: z.number().int().min(10).max(500)`).
- [ ] **AC2:** Por cada lote: `UPDATE ... IN (ids[lote])` + `INSERT outbox` (lote). Si un lote falla, registrar en `sync_logs` con `phase='batch_N'` y continuar con el siguiente.
- [ ] **AC3:** Respuesta final incluye `batches: [{ index, candidates, requeued, status, error? }]` y `partial: boolean` (true si al menos un lote falló).
- [ ] **AC4:** Timeout guard: si el wallclock supera 45s, interrumpir el bucle y retornar `truncated: true` con el cursor (`last_processed_id`) para que el cliente reintente.
- [ ] **AC5:** Test unitario que simule 250 pendientes y verifique que se generan 3 lotes (100/100/50) y un solo `sync_logs` agregado.

## Notas

- No cambiar el contrato existente (org_id + dry_run siguen iguales). `batch_size`, `partial`, `batches`, `truncated`, `last_processed_id` son aditivos.
- El cursor de AC4 puede implementarse con `ORDER BY created_at ASC, id ASC` + `(created_at, id) > (cursor)`.
- Considerar mover el bulk a `pgmq` si los lotes >500 se vuelven recurrentes (fuera de scope acá).

## Riesgos

- Aumentar `batch_size` por encima de 200 puede disparar el límite de payload de PostgREST (~1MB). Documentar en el body schema.
- `truncated=true` exige que el cliente sepa reintentar; añadir handling en `EinvoiceShiftWidget` y `admin-cms/Facturacion` cuando se implemente.
