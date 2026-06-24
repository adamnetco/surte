# POS — Bulk Retry hardening: E2E, idempotencia y backoff

**Estado:** IN_REVIEW
**Módulo:** edge `einvoice-resend-bulk-admin` + `sync-outbox-flush`
**Wave:** Follow-up de [POS-einvoice-bulk-retry-admin](./POS-einvoice-bulk-retry-admin.md) y [POS-optimizar-bulk-retry-timeouts](./POS-optimizar-bulk-retry-timeouts.md)

## Problema

Tras shippear el bulk retry multi-org (AC1–AC7) y el batching/wallclock+cursor (AC1–AC5), quedan tres gaps de robustez detectados en code-review:

1. **No hay protección contra doble disparo.** Si la UI reenvía el request (retry del usuario, reanudación con cursor o reintento de red), se generan filas duplicadas en `sync_outbox` y se inflan los logs.
2. **Las filas de outbox del bulk no llegaban al worker.** El insert usaba `operation: "einvoice_emit"` cuando la columna real es `target` y el dispatcher `sync-outbox-flush` solo conoce `target='einvoice_emit_retry'`. Resultado: las filas quedaban huérfanas y **nunca se reenviaban** — no había backoff real.
3. **Cobertura de tests limitada al stub mínimo.** No hay un escenario E2E que combine selects, updates, inserts, sync_logs y un loop multi-org con datos realistas.

## Outcomes

- [x] **AC1 — Idempotencia por request:** `BodySchema` acepta `idempotency_key: uuid` opcional. Si el cliente reenvía el mismo `idempotency_key` dentro de 24h, el endpoint devuelve la respuesta cacheada con `{ idempotent_replay: true }` sin tocar DB. La cache se persiste en `sync_logs` con `service_name='einvoice_bulk_retry_admin_idem'` y `payload.idempotency_key`. Si la corrida se trunca por wallclock, se cachea **solo** cuando termina (no parcial), para que el cursor permita reanudar.
- [x] **AC2 — Backoff exponencial real:** El insert en `sync_outbox` ahora usa `target='einvoice_emit_retry'` + `attempts: 0` + `max_attempts: max_retries ?? 5` + `next_attempt_at: now`. Eso integra el bulk con el dispatcher existente (`sync-outbox-flush`), que reaplica `BACKOFF_MIN=[1,5,30,120,720]` minutos con jitter ±20% y mueve a `dead_letter` tras agotar intentos.
- [x] **AC3 — Idempotencia a nivel outbox:** Cada fila del outbox lleva `payload.idempotency_key` para que un reproceso de la misma factura quede trazable y deduplicable a futuro (FK a marker row).
- [x] **AC4 — E2E con stub realista:** Suite ampliada `index_test.ts` cubre escenario E2E (3 orgs, mix de éxito/error/dry_run, 350 facturas distribuidas, validación de cada update/insert + sync_logs), short-circuit por `idempotency_key`, y persistencia del marker idempotente.
- [x] **AC5 — Tests del contrato outbox:** Verificación de que cada fila del outbox lleva `target='einvoice_emit_retry'`, `max_attempts`, `next_attempt_at`, `attempts: 0` y `payload.idempotency_key`.

## Criterios de aceptación verificables

| AC | Cómo se valida | Estado |
|---|---|---|
| AC1 | `BodySchema` extiende `idempotency_key`. `processBulkRetry` consulta `sync_logs` por marker y short-circuita con `idempotent_replay:true` | ✅ |
| AC2 | Cada fila de `sync_outbox` insertada por el bulk tiene `target='einvoice_emit_retry'`, `max_attempts`, `next_attempt_at`, `attempts: 0` | ✅ |
| AC3 | `payload.idempotency_key` presente en cada fila de outbox cuando el caller lo envía | ✅ |
| AC4 | Test `E2E multi-org realistic flow` + `idempotency short-circuit` + `idempotency marker persistence` en `index_test.ts` | ✅ |
| AC5 | Test `outbox rows use target=einvoice_emit_retry with backoff fields` | ✅ |

## Notas

- El marker idempotente es **best-effort** (24h TTL implícito por la query); si `sync_logs` no es accesible, el endpoint procesa normalmente (fail-open por compatibilidad).
- El TTL no se purga: depende de la retención global de `sync_logs`. Si se vuelve grande, agregar índice parcial `WHERE service_name='einvoice_bulk_retry_admin_idem'`.
- `max_retries=0` desactiva el backoff (worker no reintentará).
- Tests: 25/25 verde.

## Riesgos

- Marker insert falla silenciosamente → un replay subsiguiente re-ejecuta. Aceptable: el peor caso es duplicar reencolado (idempotencia best-effort).
- Cambio de contrato `operation → target`: filas viejas con `operation` quedan huérfanas. Migración manual no requerida (eran filas dead-on-arrival).

---

## Ampliación 2026-06-24 · Auditoría + cobertura adicional

### Auditoría UI (superadmin)

Ruta: `/superadmin/einvoice-bulk-retry/auditoria` (`EinvoiceBulkRetryAudit.tsx`).

- Lee `sync_logs` filtrado por `service_name in ('einvoice_bulk_retry_admin','einvoice_bulk_retry_admin_idem')` en ventana configurable (default 24h).
- Agrupa por `idempotency_key` usando el marker `..._idem`; las corridas sin marker (truncadas o sin idem) caen a buckets huérfanos por `requested_by`+minuto.
- Estado derivado: `succeeded | failed | truncated | running` (función `deriveStatus`).
- Detalle expandible por corrida: lista de filas agregadas por org con `requeued/batches`, `failed_batches`, `last_processed_id`, `phase`, mensaje de error.

### Cobertura adicional de pruebas

Añadidas en `supabase/functions/einvoice-resend-bulk-admin/index_test.ts`:

- **Contract tests** (7 nuevos): target, attempts=0, max_attempts ∈ [0..10], `next_attempt_at` ISO válido y dentro de la ventana de la llamada, preservación de `idempotency_key`, `status='pending'`, `organization_id` uuid-shaped, `payload.invoice_id/organization_id/forced_retry/admin/bulk` siempre presentes.

Nuevo archivo `supabase/functions/sync-outbox-flush/backoff_test.ts` + helper puro `backoff.ts`:

- Simula reintentos transitorios (5xx/timeouts) y valida que `attempts` incremente y `next_attempt_at` siga la ventana 1/5/30/120/720 min.
- Verifica que `permanent:true` (4xx Innapsis) corte el ciclo a `dead` inmediato.
- Verifica jitter ±20%.
- Simulación E2E `3 fallos + 1 éxito` demuestra que **un mismo row** se reprograma sin emitir nuevas filas (no duplica envíos).

**Suite total**: 39/39 verde (33 bulk-admin + 6 backoff).
