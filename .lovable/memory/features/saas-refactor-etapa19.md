---
name: SaaS Refactor Etapa 19
description: Fix cron broadcast invocation tras hardening etapa 17 + service_role bypass
type: feature
---

# Etapa 19 — Reparar cron de broadcasts + service_role bypass

## Problema detectado en Etapa 17
`broadcast-whatsapp-ycloud` exigía `claims.sub` (usuario humano) y `organization_id` con membership. Esto rompió `process-scheduled-broadcasts` (cron) que invocaba sin user JWT y sin `organization_id`.

## Cambios
- **`broadcast-whatsapp-ycloud`**:
  - Acepta caller con `claims.role === 'service_role'` (cron interno) además de usuario humano.
  - En modo service_role salta la verificación de membership pero sigue exigiendo `organization_id` en payload (responsabilidad del invocador).
- **`process-scheduled-broadcasts`**:
  - SELECT incluye `organization_id` de `broadcast_logs` (poblado desde Etapa 17).
  - Falla la fila si no tiene `organization_id` (no se permite broadcast sin tenant).
  - Pasa `organization_id` en el body al invocar.

## Verificación
- E2E (Etapa 18) sigue rechazando llamadas cross-tenant: el bypass solo aplica con service_role, no con user JWT ajeno.
- Cron vuelve a despachar broadcasts pendientes que tengan `organization_id` correcto.

## Pendientes Etapa 20+
- Endurecer CSP a enforcing (revisar violaciones en CSP-Report-Only de etapa 18).
- Billing por organización (subscriptions + invoices ya existen, falta UI agregada por org).
- Rate-limit en `lead-capture` (anon endpoint público sin throttling).
