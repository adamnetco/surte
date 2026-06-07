# Auditoría de Login y plan de corrección

## Diagnóstico (estado actual)

Hoy hay **3 entradas de login mezcladas** que confunden el flujo multi-tenant:

| Ruta / Host | Componente | Para quién | Estado |
|---|---|---|---|
| `surteya.sistecpos.com/login`, `/user/login`, `/admin/login` | `Login.tsx` | Clientes finales de la tienda | ✅ Funciona, pero **branding hardcoded** a "SURTÉ YA" (`surteLogo`, copy) |
| `admin.sistecpos.com/` | `LoginRouter.tsx` | Operadores SaaS (superadmin/admin/agente) | ✅ OK pero su ruta `/admin/login` cae en `Login.tsx` (cliente) |
| `app.sistecpos.com/login` | `Login.tsx` (cliente) | Debería ser portal SaaS | ❌ Muestra UI de tienda sin marca |

**Resultado:** la semilla `surteya` funciona "por accidente" (el branding hardcoded coincide). Cualquier tenant nuevo (`pizzeria.sistecpos.com`, etc.) verá el logo de Surteya en su login → no se cumple multi-tenant.

La captura adjunta lo confirma: muestra el banner amarillo de auth inestable encima del login de cliente, con marca Surteya fija.

## Cambios

### 1. `Login.tsx` → tenant-aware

- Leer branding desde `organizations` por slug detectado (`detectTenant()` o `:slug` de ruta `/t/:slug`).
- Mostrar `logo_url`, `name`, `primary_color` del tenant en lugar de `surteLogo` fijo.
- Fallback al logo de SistecPOS si no hay tenant (host de sistema).
- En `signUp`, persistir `organization_id` del tenant detectado en el `profiles` insertado por el trigger (vía `options.data.organization_slug`) para que el cliente quede vinculado a SU negocio.

### 2. Routing limpio

```text
HOST                                  /            /login         /admin/login
sistecpos.com / www / app.*          LoginRouter   LoginRouter    LoginRouter
admin.sistecpos.com                  LoginRouter   LoginRouter    LoginRouter
<slug>.sistecpos.com (storefront)    Index         Login(tenant)  → /login (redir)
```

- Eliminar la duplicación: `/user/login` y `/admin/login` redirigen a `/login` (mismo componente que detecta el host).
- En hosts de sistema, `/login` renderiza `LoginRouter` (portal SaaS dark, ya existente).
- En hosts de tenant, `/login` renderiza `Login` (branded por tenant).

### 3. Componente `<TenantAwareLogin />` (nuevo wrapper)

Único punto de entrada para las 3 rutas; decide qué render mostrar según `isStorefrontTenant(detectTenant())`. Evita renombrar `Login.tsx` y `LoginRouter.tsx` para no romper imports.

### 4. Migración mínima

Asegurar que `organizations` tenga `logo_url`, `primary_color`, `brand_short_name` (revisar y crear si faltan). El signup del cliente queda ligado al tenant vía un trigger ya existente `handle_new_user` (extender para leer `organization_slug` de `raw_user_meta_data` y poblar `profiles.organization_id`).

### 5. Code-review pasada

- Tipos estrictos en branding (`TenantBrand`).
- `useTenantBrand()` hook con cache en memoria.
- Skeleton mientras carga (no flash de logo SistecPOS).
- A11y: `<h1>` único, `aria-label` correctos, `autoComplete` ya OK.

## Detalles técnicos

- Archivos nuevos:
  - `src/modules/auth/components/TenantAwareLogin.tsx`
  - `src/modules/auth/hooks/useTenantBrand.ts`
- Archivos editados:
  - `src/modules/auth/pages/Login.tsx` — quitar `surteLogo` import; recibir `brand` como prop.
  - `src/App.tsx` — `/login`, `/user/login`, `/admin/login` → `<TenantAwareLogin />`.
- Migración (si falta): `ALTER TABLE organizations ADD COLUMN ... logo_url, primary_color, brand_short_name`. Trigger `handle_new_user` actualizado para leer `organization_slug`.

## Validación

1. `surteya.sistecpos.com/login` → muestra logo y nombre Surteya (igual que hoy, parity check).
2. `admin.sistecpos.com/login` → muestra `LoginRouter` (dark) en lugar del login de cliente.
3. `?tenant=demo` con un tenant nuevo → muestra su marca, NO la de Surteya.
4. Signup de cliente en tenant → `profiles.organization_id` queda con el id del tenant.

## Out of scope

- Rediseño visual (mantiene la estética actual de cada login).
- Migración de usuarios existentes entre tenants.
- SSO empresarial (ya existe `sso-issue`/`sso-consume`, no se toca).

---

¿Apruebas este plan? Si quieres, podemos partir en 2 PRs: (A) routing unificado + branding tenant, (B) trigger de `organization_id` en signup.
