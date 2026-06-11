---
name: SaaS Refactor — Etapa 22 (Auditoría Tenant-Scope v7)
description: Auditoría edge functions multi-tenant + hardening de 6 funciones de alto/medio riesgo + helper `_shared/tenant-guard.ts`.
type: feature
---

# Etapa 22 — Auditoría Tenant-Scope v7

Sub-agente auditó las 34 edge functions. Resultado: 4 riesgo ALTO, 9 riesgo MEDIO.

## Hardening aplicado en esta etapa

### Helper compartido nuevo
- `supabase/functions/_shared/tenant-guard.ts`: exporta `requireAuth`, `requireMembership`, `requireAdminRole`, `serviceClient`, `userClient`, `jsonResponse`, `corsHeaders`. Detecta tokens `service_role` por payload JWT.

### Riesgo ALTO — corregido
1. **cloudflare-domain-reprovision**: ahora exige JWT + role admin/superadmin + membership sobre la org dueña del `tenant_domains.organization_id`.
2. **cloudflare-domain-status**: idem.
3. **optimize-image**: JWT obligatorio + bucket allowlist (`product-images`, `category-images`, `brand-logos`, `banners`, `hero-slides`, `gallery`, `landing-media`, `site-assets`, `site-logos`) + host allowlist anti-SSRF (Supabase, Lovable, Unsplash, GCS, AWS, Cloudinary; bloquea localhost / RFC1918) + sanitiza `path` contra `..` y rutas absolutas.
4. **send-whatsapp-order**: JWT pasa de opcional a **obligatorio**; cero creación de órdenes anónimas.

### Riesgo MEDIO — corregido
5. **verify-tenant-domain**: dejó de usar `SERVICE_ROLE_KEY` con header `Authorization` (anti-patrón que ignora RLS). Ahora valida JWT con anon client + membership sobre `d.organization_id` antes de cualquier update.
6. **cloudflare-domain-connect**: además del role admin global, agrega membership-check sobre `tenant_sites.organization_id` para que un admin de org X no pueda conectar dominios para org Y.

## E2E ampliado
`scripts/e2e-tenant-isolation.ts` agrega 4 nuevos casos:
- A intenta `cloudflare-domain-status` sobre hostname de B
- A intenta `verify-tenant-domain` sobre `domain_id` de B
- Anónimo intenta `send-whatsapp-order`
- Anónimo intenta `optimize-image` con bucket inválido + path traversal

## Pendiente para Etapa 23 (riesgo MEDIO restante)
- `send-ycloud-whatsapp` + `send-callmebot`: pasar `organization_id` y scopear `app_settings` por org.
- `log-login-attempt`: eliminar lookup reverso `profiles.email → user_id` (info-leak).
- `send-transactional-email` + `process-email-queue`: defensa en profundidad con role check in-function.
- `cart-sync`: rate-limit y validar que `_user_id` no se inyecte.
- `fetch-google-reviews`: JWT + role admin (operación de backoffice).

## Reporte completo
Ver `docs/audit/tenant-scope-2026-06-11-v7-etapa22.md`.
