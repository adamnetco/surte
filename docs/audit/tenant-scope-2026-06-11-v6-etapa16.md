# Tenant Scope Audit — v6 (Etapa 16)

## Edge Functions

| Function | Status | Mecanismo |
| --- | --- | --- |
| send-web-push | ✅ FIXED | auth claims + membership(owner/admin) + `.eq(organization_id, payload.organization_id)` |
| sync-order | ✅ FIXED | auth claims + membership + `app_settings` por-org, update con `.eq(organization_id)` |
| sync-products-to-wp | ✅ OK | `tenant_wp_config -> tenant_sites.organization_id` + membership |
| invoice-ocr | ✅ OK | membership + queries scoped |
| cart-sync | ✅ OK | cart_token UUID actúa como capability; RPC valida |
| sync-outbox-flush / retry | ⚠ revisar | scoped por payload pero ejecuta como service_role (cron-style) |
| broadcast-whatsapp-ycloud, process-scheduled-broadcasts | ⚠ revisar en E17 | requieren auditoría similar |

## DB
- `push_subscriptions.organization_id` y `push_broadcast_logs.organization_id` añadidos + RLS reescrito.
- 50 advertencias `SECURITY DEFINER` aceptadas (helpers RLS).
- 2 buckets públicos aceptados (media de productos / banners).

## E2E
- `scripts/e2e-tenant-isolation.ts` cubre 16 tablas + send-web-push cross-tenant.
- Falla con exit≠0 ante cualquier leak.
