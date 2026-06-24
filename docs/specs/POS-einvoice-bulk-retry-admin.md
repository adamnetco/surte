# POS — Bulk Retry Admin Multi-Org (follow-up AC5)

**Estado:** IN_REVIEW
**Módulo:** edge `einvoice-resend-bulk-admin` (NEW) + `admin-cms/Facturacion`
**Wave:** Follow-up de [POS-einvoice-retry-scoping](./POS-einvoice-retry-scoping.md) AC5

## Problema

`einvoice-resend` con `retry_all_today` ahora exige `organization_id` (POS-einvoice-retry-scoping AC1). Eso bloquea el caso superadmin que necesita reintentar pendientes a través de **varias** organizaciones desde un solo botón en `admin-cms/Facturacion`.

## Decisión de arquitectura

Endpoint **separado** `einvoice-resend-bulk-admin` en vez de extender `einvoice-resend`. Razones:

1. **Aislamiento de scope:** `einvoice-resend` queda con un único modo seguro (1 org / caller con membresía). El multi-org admin es una superficie completamente distinta.
2. **Blast radius controlado:** un bug en el bulk admin no puede afectar el reintento normal del POS.
3. **Auth diferenciada:** `einvoice-resend` valida `organization_members.role`; el admin valida `user_roles.role='superadmin'` vía `has_role`. Mezclarlos requeriría ramas condicionales frágiles.
4. **Auditoría separable:** `sync_logs.service_name='einvoice_bulk_retry_admin'` permite filtrar acciones masivas de superadmin sin ruido del POS diario.

## Outcomes

- [x] **AC1:** Endpoint nuevo `einvoice-resend-bulk-admin` con body `{ organization_ids: uuid[] (1..20), dry_run?: bool }`. Validación Zod estricta — `400 invalid_payload` si falla.
- [x] **AC2:** Solo accesible para `has_role(auth.uid(),'superadmin')=true`; resto recibe `403 superadmin_required`. Ningún rol de `organization_members` lo habilita (ni `owner`/`admin` de una org concreta).
- [x] **AC3:** Itera org por org con la **misma** lógica batch que `einvoice-resend` (SELECT pendientes del día → UPDATE in → INSERT outbox). Si un org falla, las demás siguen procesándose y el error queda en `sync_logs` con `service_name='einvoice_bulk_retry_admin'`, `status='error'`, `phase='query'|'update'|'outbox'`.
- [x] **AC4:** `dry_run=true` no muta: devuelve `candidates` por org sin tocar `electronic_invoices` ni `sync_outbox`. Cubre el preview de UI.
- [x] **AC5:** Respuesta agregada: `{ success, dry_run, total_orgs, total_requeued, results: [{ organization_id, candidates, requeued, status, error? }] }`. Cada org se loguea con su propio row de `sync_logs`.
- [ ] **AC6 (UI, fuera de scope edge):** Página `admin-cms/Facturacion/BulkRetry` con multi-select de orgs visibles para el superadmin + botón "Preview" (dry_run) + botón "Reencolar" (commit). _Pendiente: spec separado cuando se construya el UI._

## Criterios de aceptación verificables

| AC | Cómo se valida | Estado |
|---|---|---|
| AC1 | `BodySchema` en `supabase/functions/einvoice-resend-bulk-admin/index.ts` (array uuid 1..20) | ✅ |
| AC2 | RPC `has_role(_user_id, 'superadmin')`; ramificación a 403 | ✅ |
| AC3 | Loop `for (const orgId of organization_ids)` con manejo de error por org y continue | ✅ |
| AC4 | Branch `if (dry_run \|\| ids.length === 0)` retorna sin UPDATE/INSERT | ✅ |
| AC5 | `results.push({...})` por org + agregados `total_orgs`/`total_requeued` | ✅ |
| AC6 | Pendiente — bloqueado hasta confirmar dueño del módulo `admin-cms/Facturacion` | ⬜ |

## Riesgos & mitigación

- **Risk:** un superadmin dispara accidentalmente bulk sobre 20 orgs grandes → timeout edge.
  - **Mitigación inmediata:** cap de 20 orgs por request (AC1).
  - **Mitigación follow-up:** ver `POS-optimizar-bulk-retry-timeouts.md` (batching + cursor).
- **Risk:** falta de rate-limit permite spam.
  - **Mitigación:** confiar en `sync_logs` para detectarlo; rate-limit nativo se evalúa si aparece abuso real.
- **Risk:** la UI todavía no existe → el endpoint puede llamarse solo con `curl`.
  - **Aceptable** porque está restringido a superadmin; documentar en runbook.

## Notas

- No exponer en POS: solo en `/admin/facturacion/bulk-retry` (cuando exista UI).
- Tests E2E del endpoint quedan pendientes del harness Deno; el contrato 403/200 se valida en code review.
- El cap de 20 orgs y la falta de batching interno se cubren en `POS-optimizar-bulk-retry-timeouts.md`.
