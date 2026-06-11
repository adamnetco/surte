---
name: SaaS Refactor Etapa 30 — Auditoría edge functions restantes
description: Cierre de gaps en sync-products-to-wp, sync-outbox-flush y reseed-demo
type: feature
---

# Etapa 30

## Hallazgos y fixes

### 1. `sync-products-to-wp` — Cross-tenant leakage (HIGH)
La query a `products` no filtraba por `organization_id`. Como el cliente se crea con `SERVICE_ROLE_KEY`, RLS quedaba bypassada y un admin de tenant A podía sincronizar productos de tenant B a su WordPress.
**Fix**: `.eq("organization_id", orgId)` explícito en el `select`.

### 2. `sync-outbox-flush` — Endpoint público sin auth (MEDIUM)
La función estaba expuesta sin verificación, permitiendo que cualquiera drenara la cola y disparara reintentos.
**Fix**: requiere `Authorization: Bearer <SERVICE_ROLE_KEY>` o `Bearer <CRON_SECRET>`. Devuelve 401 en caso contrario. El cron de pg_cron sigue funcionando porque ya envía `service_role`.

### 3. `reseed-demo` — Privilege escalation (HIGH)
Aceptaba `admin` global, lo que permitía a cualquier admin de tenant otorgarse rol admin sobre la organización demo.
**Fix**: solo `is_master_superadmin` o rol `superadmin` explícito.

## Funciones revisadas y sanas
- `invoice-ocr`, `ai-manager`, `printer-event-log`, `tenant-create-with-owner`, `preview-transactional-email` (LOVABLE_API_KEY), `process-email-queue` (Bearer + JWT claims), `handle-email-suppression/unsubscribe` (firma/token pre-existente), `sitemap/get-landing/resolve-tenant` (público read-only por diseño).

## Próximo
- Etapa 31 candidata: Trusted Types report-only (DOM-XSS mitigation) — primera fase del lock-down de `'unsafe-inline'`.
- Etapa 32: rate-limit en DB (sliding window) para lead-capture / cart-sync / csp-report.
