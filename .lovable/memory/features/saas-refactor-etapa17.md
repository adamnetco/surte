---
name: SaaS Refactor Etapa 17
description: Tenant scope en broadcasts WhatsApp + notification_subscriptions + perf indexes
type: feature
---

# Etapa 17 — Broadcasts multi-tenant + performance

## 1. Schema multi-tenant
- `notification_subscriptions.organization_id` (FK organizations, cascade). Backfill desde `profiles.organization_id`.
- `broadcast_logs.organization_id` (FK organizations, cascade). Backfill desde `profiles` del `sent_by`.
- RLS reescrita: solo `can_write_org(organization_id)` (owner/admin/cashier) o master superadmin gestionan filas de su org.
- Política `Anyone can subscribe` (INSERT anon) mantenida — el formulario público debe inyectar `organization_id` del tenant.

## 2. `broadcast-whatsapp-ycloud`
- Requiere `Authorization: Bearer` con `getClaims`.
- Exige `organization_id` en body (excepto `action=list_templates`).
- Valida que el caller sea miembro activo owner/admin/cashier de esa org.
- Audience query filtra `notification_subscriptions.organization_id = :org`.
- `broadcast_logs` insert/update scoped por `organization_id`.

## 3. Performance indexes
- `idx_print_jobs_org_status (organization_id, status, created_at DESC)`
- `idx_pos_payments_org (organization_id, created_at DESC)`
- `idx_table_order_items_org (organization_id)`
- `idx_pos_order_items_org (organization_id)`
- `idx_order_items_org (organization_id)`
- `idx_products_org_active (organization_id, is_active)`
- `idx_notification_subs_org_active (organization_id, is_active)`
- `idx_broadcast_logs_org (organization_id, created_at DESC)`

## Pendientes
- Frontend de captura de suscripciones debe pasar `organization_id` del tenant resuelto.
- `process-scheduled-broadcasts` (cron) ya usa el log existente, hereda scope vía `organization_id` ya persistido.
