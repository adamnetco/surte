---
name: SaaS Refactor Etapa 16
description: RLS lint, edge function tenant-scope, E2E isolation smoke test
type: feature
---

# Etapa 16 — Hardening final

## 1. RLS Lint
- 52 hallazgos: 2 buckets públicos (intencionales: media de productos), 50 `SECURITY DEFINER` callable.
- Las funciones DEFINER (`has_role`, `is_org_member`, `get_user_org`, etc.) DEBEN serlo para evitar recursión RLS.
- Documentado en `security memory`: no son vulnerabilidades; revocar EXECUTE rompe la app.

## 2. Edge Functions Hardening
- **`push_subscriptions` / `push_broadcast_logs`**: agregada columna `organization_id`, backfill desde `organization_members`, RLS reescrito (usuarios manejan sus propias subs; owner/admin lee subs de su org).
- **`send-web-push`**: requiere `Authorization: Bearer`, valida claims, exige `organization_id` en payload, verifica que el caller sea owner/admin, filtra `push_subscriptions` por org.
- **`sync-order`**: requiere auth, busca `organization_id` del pedido, valida membership, usa `app_settings` con clave `external_sync_webhook_url:<orgId>` (fallback al global legacy), update con `.eq("organization_id", orgId)`.
- **`sync-products-to-wp`**, **`invoice-ocr`**, **`cart-sync`**: ya estaban scoped (etapas previas).

## 3. E2E Smoke Test
- `scripts/e2e-tenant-isolation.ts`: login A + B en orgs distintas, intenta leer 16 tablas críticas con `.eq("organization_id", otherOrgId)` y verifica 0 filas. También prueba `send-web-push` cross-tenant.
- Run: `bun run scripts/e2e-tenant-isolation.ts --emailA=a@x --passA=… --emailB=b@x --passB=…`
- Exit code != 0 si detecta cualquier leak.

## Estado final del proyecto SaaS
- 15 etapas previas + esta cerraron el aislamiento multi-tenant en frontend, admin, POS, storefront y edge functions.
- Hallazgos del audit estático: 2 (test stub + legacy Login).
- Próximo objetivo sugerido: perf (índices `(organization_id, ...)`), CSP headers, billing por organización.
