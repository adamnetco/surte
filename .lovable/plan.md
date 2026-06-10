# Plan de refactorización SistecPOS Core — POS nativo

## Estado

- ✅ **Fase 1** — Cortado el cordón con `softwarepos.online`. `ClientPOSAccess` ahora navega a `/pos` nativo. `ClientPOSLogin.tsx` eliminado.
- ✅ **Fase 2** — Demo SistecPOS sembrada (módulos, sede, caja, cocina, mesas, categorías, 10 productos). Bug `pos_counter`→`pos` corregido.
- ✅ **Fase 3** — RBAC + telemetría: `UsersTab` oculta selects de rol/biz a no-admins y bloquea autocambios; `signIn` registra éxitos en `auth_login_events` y delega los fallos a la edge function `log-login-attempt` (service role).
- ✅ **Fase 4** — Tabla `client_pos_sessions` eliminada (estaba vacía, sin RPC ni edge function activas). No quedan referencias funcionales a `softwarepos.online` en `src/`.
- ✅ **Fase 5** — Observabilidad mínima:
  - `src/lib/logger.ts` wrapper único (debug silenciado en prod, buffer en sessionStorage para warn/error, listo para enchufar Sentry / `app_errors`).
  - Regla ESLint `no-restricted-syntax` que bloquea el literal `softwarepos.online` en `Literal` y `TemplateElement` (comentarios siguen permitidos, donde solo queda como referencia histórica en `ClientPOSAccess.tsx`).
  - E2E `e2e/pos.spec.ts` ya cubre que `/pos` carga sin pageerror y sin overlays atascados.
- ✅ **Fase 6** — Modal de módulos por organización se alimenta de `public.modules` (DB-driven, agrupado por categoría). Se limpiaron 8 `module_key` huérfanos y se añadieron `whatsapp`, `fiscal`, `compras` al catálogo.

- ✅ **Fase 2.5** — Edge function `reseed-demo` desplegada. Crea (si falta) el usuario `demo@sistecpos.com` con `email_confirm=true`, lo vincula a la org demo (`59a4032f…`) como `admin` en `organization_members` y le otorga `user_roles.role='admin'`. Solo invocable por superadmin/admin autenticado:
  ```ts
  supabase.functions.invoke("reseed-demo")
  ```
  Recomendación: enviar magic-link al demo email después de invocar (la contraseña inicial es aleatoria).

## Pendiente


### Fase 5+ — Próximos pasos de observabilidad
- Migrar `console.error` / `console.warn` críticos a `logger.*` (módulo por módulo).
- Crear tabla `app_errors` + edge function `ingest-log` para drenar el buffer de sessionStorage.
- Sentry SDK detrás de feature flag `obs.sentry`.

## Documentación viva
- `mem://features/pos-native-login`
- `mem://features/demo-tenant-seed`
- `mem://features/post-license-onboarding`
- `mem://features/modules-catalog-source`
- `mem://features/desktop-release-publishing` (pospuesta)
