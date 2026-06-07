# Módulo: tenant

Multi-tenant: detección de subdominio, scoping de queries por `organization_id`,
sincronización de tenant activo con la ruta y "data islands" para superadmin.

## Estructura
- `lib/subdomain.ts` — `detectTenant`, `isSystemTenant`, `isStorefrontTenant`, `isPreviewHost`.
- `lib/tenantScope.ts` — `scopedFrom`, `scopedSelect`, `tenantChannelFilter`.
- `lib/tenantDataIsland.ts` — `ISLAND_TABLES`, `forceOrgOnRows`.
- `hooks/useTenantFromRoute.ts` — sincroniza `OrganizationContext` con `:slug`.

## Reglas
- Consumir SIEMPRE desde `@/modules/tenant` (barrel). No usar deep imports.
- Toda query por `organization_id` debe pasar por `scopedFrom`/`scopedSelect`.
- No depender de otros módulos de negocio (`pos`, `admin-cms`, etc.).
- `resolveTenant` server-side vive en `supabase/functions/resolve-tenant` y en
  el starter `astro-starter/src/lib/tenant.ts`.
