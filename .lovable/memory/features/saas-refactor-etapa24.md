---
name: SaaS Refactor Etapa 24 — app_settings multi-tenant en WhatsApp
description: send-ycloud-whatsapp y send-callmebot ahora leen app_settings scoped por organization_id con fallback global
type: feature
---

# Etapa 24

## Cambios
- `_shared/tenant-guard.ts`: añadidos helpers `resolveCallerOrgId` (deriva org del caller o valida body.organization_id contra membership) y `getOrgScopedSettings` (lee app_settings filtrando por org con fallback a NULL global).
- `send-ycloud-whatsapp`: ahora resuelve org del caller y obtiene `ycloud_api_key`/`ycloud_from_number` con scope multi-tenant. Acepta `organization_id` opcional en body (validado contra membership).
- `send-callmebot`: idem para `callmebot_api_key`/`callmebot_phone`.

## Compat
- Si la org no tiene credenciales propias en `app_settings`, cae al registro global (organization_id IS NULL) — mantiene compat con instalación legacy single-tenant.
- Service role calls pueden pasar `organization_id` explícito sin validación de membership.

## Próximo
- Etapa 25 candidata: pasar CSP de Report-Only a enforcing (telemetría 24-48h ya pasada).
- Etapa 26: rate-limit en lead-capture / cart-sync.
