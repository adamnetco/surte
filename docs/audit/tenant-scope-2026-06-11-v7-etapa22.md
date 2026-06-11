# Auditoría Tenant-Scope v7 — Etapa 22

Fecha: 2026-06-11
Auditor: sub-agente acp_subagent (read-only)

## TL;DR
34 edge functions auditadas. 4 ALTO + 9 MEDIO. Esta etapa cierra los 4 ALTOS + 2 de los 9 MEDIO (verify-tenant-domain, cloudflare-domain-connect).

## Hallazgos ALTO (cerrados)

| Función | Hallazgo original | Fix Etapa 22 |
|---|---|---|
| cloudflare-domain-reprovision | Sin JWT, service_role directo | JWT + role admin + membership por hostname |
| cloudflare-domain-status | Sin JWT, service_role directo | JWT + role admin + membership por hostname |
| optimize-image | Sin JWT, SSRF, escritura arbitraria en Storage | JWT + bucket allowlist + host allowlist + sanit path |
| send-whatsapp-order | Auth opcional → órdenes anónimas | JWT obligatorio |

## Hallazgos MEDIO

| Función | Estado |
|---|---|
| cart-sync | Pendiente (rate-limit) |
| fetch-google-reviews | Pendiente (JWT + role admin) |
| log-login-attempt | Pendiente (quitar lookup user_id) |
| send-ycloud-whatsapp | Pendiente (org-scoping) |
| send-callmebot | Pendiente (org-scoping) |
| verify-tenant-domain | ✅ Cerrado |
| send-transactional-email | Pendiente (role check defensa en profundidad) |
| process-email-queue | Pendiente (role check admin) |
| cloudflare-domain-connect | ✅ Cerrado (membership) |

## OK (sin cambios)
innapsis-emit, innapsis-status, invoice-ocr, printer-event-log, sync-products-to-wp, wp-revalidate-webhook, health-snapshot, handle-email-suppression, handle-email-unsubscribe, preview-transactional-email, reseed-demo, license-issue, license-purchase-webhook, license-activate, license-heartbeat, tenant-create-with-owner, provision-organization, sso-issue, sso-consume, welcome-dispatcher, lead-capture (público por diseño).

## E2E
`scripts/e2e-tenant-isolation.ts` ampliado con 4 nuevos casos cross-tenant.
