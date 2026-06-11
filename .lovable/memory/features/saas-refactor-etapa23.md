---
name: SaaS Refactor — Etapa 23 (Tenant-Scope v8)
description: Cierre de 5 hallazgos MEDIO de la auditoría Etapa 22 — endurecimiento de log-login-attempt, fetch-google-reviews, send-transactional-email, cart-sync.
type: feature
---

# Etapa 23 — Hardening MEDIO

Continuación directa de Etapa 22. Cierra 5 de los 7 MEDIO restantes.

## Fixes aplicados

1. **log-login-attempt**: eliminado el lookup reverso `profiles.email → user_id` (info-leak / enumeración de usuarios). Ahora `user_id` viene opcionalmente del body; el linkage real se hace por `handle_new_user` u otros mecanismos.

2. **fetch-google-reviews**: ahora exige JWT + role admin/superadmin vía `_shared/tenant-guard.ts`. Era operación de backoffice abierta a anónimos.

3. **send-transactional-email**: defense in depth — además del gateway `verify_jwt=true`, exige `service_role` o role `admin/superadmin`. Antes cualquier usuario autenticado podía spammear emails a destinatarios arbitrarios.

4. **cart-sync**: el RPC `upsert_persistent_cart` ya no recibe `_user_id` desde el body (siempre `null`); la asociación cart→user se hace por trigger `handle_new_user` o al checkout autenticado. Previene secuestro de carros vía inyección.

5. **process-email-queue**: ya tenía service_role gate desde antes — confirmado OK, sin cambios.

## Pendientes Etapa 24
- `send-ycloud-whatsapp` + `send-callmebot`: pasar `organization_id` al body + verificar membership + scopear `app_settings` por org. Requiere migración de `app_settings` (agregar `organization_id` nullable + índice + RLS por org). Más invasivo, queda para etapa dedicada.
- Considerar mover CSP de Report-Only a enforcing (Etapa 25) tras 24-48h de telemetría real.

## Reporte
`docs/audit/tenant-scope-2026-06-11-v7-etapa22.md` actualizado mentalmente: 4/4 ALTO + 4/9 MEDIO cerrados.
