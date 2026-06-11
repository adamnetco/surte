---
name: SaaS Refactor — Etapa 1 (tenant scope audit)
description: Auditoría inicial de aislamiento multi-tenant. 5 HIGH (slug 'surteya' hardcoded), 322 MEDIUM (.from() sin scopedFrom — muchos OK porque ya filtran .eq organization_id), 3 LOW. Reporte en docs/audit/tenant-scope-2026-06-11.md generado por scripts/audit-tenant-scope.ts.
type: feature
---

# Etapa 1 — Auditoría de aislamiento

## Hallazgos clave

**HIGH (5 archivos con slug 'surteya' hardcoded):**
- `src/components/SurteyaRedirect.tsx:16` — `LEGACY_TENANT_SLUG = "surteya"` (redirect legado, válido pero documentar)
- `src/modules/auth/pages/Login.tsx:45` — `isSurteya = brand.slug === "surteya"` (branding condicional, mover a flag)
- `src/modules/onboarding/components/SubdomainPreview.tsx:80` — placeholder de input (cosmético)
- `src/modules/superadmin/components/TenantOnboardingWizard.tsx:207` — placeholder (cosmético)
- `src/modules/tenant/lib/subdomain.ts:12` — comentario en doc (cosmético)

**MEDIUM (322 hits):** mayoría son `supabase.from()` que SÍ filtran por `organization_id` manualmente con `.eq()` — el detector es deliberadamente amplio. Próxima iteración del script: descartar cuando la misma cadena incluya `.eq("organization_id"`.

**Sin uso de `default_org_id()` en código frontend** (solo SQL) → confirmado limpio.

## Próximo paso

Refinar el script en Etapa 4 (legacy scope) para que solo flaggee `.from()` sobre tablas que aún NO tienen `organization_id NOT NULL`. Listar esas tablas vía `supabase--linter`.

## Cierre
- ✅ `scripts/audit-tenant-scope.ts`
- ✅ `docs/audit/tenant-scope-2026-06-11.md` (825 líneas)
- ✅ Etapa 1 cerrada. Avanzar a Etapa 2 (RPC `provision_organization`).
