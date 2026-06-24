# POS — Scoping de retry_all_today por organization_id

**Estado:** IN_REVIEW
**Módulo:** edge `einvoice-resend` + `EinvoiceShiftWidget`
**Wave:** Follow-up de [POS-innapsis-emision-pos](./POS-innapsis-emision-pos.md) (Observación #4 del review)
**Tablas:** `electronic_invoices`, `sync_outbox`

## Problema

El handler `retry_all_today` en `supabase/functions/einvoice-resend/index.ts` actualmente requeue **todas las facturas pendientes del día de todas las organizaciones a las que el usuario pertenece**. Para un superadmin con visibilidad multi-tenant, esto significa reintentar facturas de organizaciones que no corresponden a la sesión POS activa.

Riesgo:
- Un superadmin haciendo soporte a Tenant A dispara reintentos en Tenant B sin saberlo.
- Logs `sync_logs` no atribuyen claramente qué turno/organización solicitó el bulk retry.

## Outcomes

- [x] **AC1:** `BodySchema` de `einvoice-resend` acepta `organization_id?: uuid`, y el handler `retry_all_today` retorna 400 `organization_id_required` si falta.
- [x] **AC2:** Handler valida `organization_members.role IN ('owner','admin','superadmin')` para esa `organization_id`; si no → 403 `admin_required_for_org`.
- [x] **AC3:** `EinvoiceShiftWidget` envía `{ action, organization_id }` al invocar la edge.
- [x] **AC4:** `sync_logs` registra `service_name='einvoice_bulk_retry'` con `payload={action, requeued_count, requested_by, since}` y `organization_id` correcto.
- [ ] **AC5:** Endpoint admin separado para retry global multi-org — **fuera de scope** de este PR (el riesgo principal queda neutralizado por AC1+AC2; pendiente como follow-up si superadmin lo requiere).

## Notas de Implementación

- Cambio breaking: clientes desactualizados que sigan enviando `retry_all_today` sin `organization_id` recibirán `400 organization_id_required`. Solo hay un consumer (`EinvoiceShiftWidget`) y se actualizó en el mismo cambio.
- Edge function deployada junto con el cambio de frontend.
- AC5 documentado pero no implementado: hoy no hay flujo de superadmin que necesite reintento global multi-tenant; cuando exista, crear `einvoice-resend-bulk-admin` con scope explícito.

</content>
</invoke>