# Módulo: auth

Autenticación, roles, guards y SSO cross-subdominio para SistecPOS.

## Estructura
- `context/AuthContext.tsx` — `AuthProvider`, `useAuth`, `AppRole`.
- `components/RoleGuard.tsx` — guard por sección/rol (DB-driven via `can_access_section`).
- `components/SSOErrorScreen.tsx` — pantalla de error de handoff SSO.
- `lib/ssoHandoff.ts` — `buildHandoffUrl`, `consumeHandoff`, mapa de tenants.
- `pages/Login.tsx`, `pages/LoginRouter.tsx`, `pages/ResetPassword.tsx`, `pages/Unsubscribe.tsx`.

## Reglas
- Consumir SIEMPRE desde `@/modules/auth` (barrel). No usar deep imports.
- No depender de otros módulos (`pos`, `admin-cms`, `storefront`, `superadmin`, `clientes`).
- Master superadmin (`eduardotp77@gmail.com`) es inmutable — ver `is_master_superadmin` en DB.

## Próximo módulo sugerido
`marketing/seo` (HeadMeta, JsonLd, SeoBreadcrumbs, Analytics, LandingPage assets).
