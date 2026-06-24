# POS — Scoping de retry_all_today por organization_id

**Estado:** DRAFT
**Módulo:** edge `einvoice-resend` + `EinvoiceShiftWidget`
**Wave:** Follow-up de [POS-innapsis-emision-pos](./POS-innapsis-emision-pos.md) (Observación #4 del review)
**Tablas:** `electronic_invoices`, `sync_outbox`

## Problema

El handler `retry_all_today` en `supabase/functions/einvoice-resend/index.ts` actualmente requeue **todas las facturas pendientes del día de todas las organizaciones a las que el usuario pertenece**. Para un superadmin con visibilidad multi-tenant, esto significa reintentar facturas de organizaciones que no corresponden a la sesión POS activa.

Riesgo:
- Un superadmin haciendo soporte a Tenant A dispara reintentos en Tenant B sin saberlo.
- Logs `sync_logs` no atribuyen claramente qué turno/organización solicitó el bulk retry.

## Outcomes

- [ ] **AC1:** `BodySchema` de `einvoice-resend` requiere `organization_id: z.string().uuid()` cuando `action = 'retry_all_today'`.
- [ ] **AC2:** Handler valida que el `user.id` autenticado tiene rol en esa `organization_id` (via `has_role` o `organization_members`). Si no → 403.
- [ ] **AC3:** `EinvoiceShiftWidget` pasa explícitamente `organization_id: currentOrganization.id` en el body al invocar la función.
- [ ] **AC4:** `sync_logs` registra `event_type='einvoice_bulk_retry'` con metadata `{organization_id, requeued_count, requested_by}`.
- [ ] **AC5:** Si el superadmin quiere retry global (todas sus orgs), debe usar un endpoint nuevo `/admin/facturacion/bulk-retry` (no expuesto al POS).

## Notas de Implementación

- Cambio breaking del schema → coordinar deploy edge + frontend en mismo PR.
- Considerar agregar `dry_run: boolean` para preview del count antes de ejecutar.
</content>
</invoke>