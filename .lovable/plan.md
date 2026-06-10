# Plan de refactorización SistecPOS Core — POS nativo

## Estado

- ✅ **Fase 1** — Cortado el cordón con `softwarepos.online`. `ClientPOSAccess` ahora navega a `/pos` nativo. `ClientPOSLogin.tsx` eliminado.
- ✅ **Fase 2** — Demo SistecPOS sembrada (módulos, sede, caja, cocina, mesas, categorías, 10 productos). Bug `pos_counter`→`pos` corregido.
- ✅ **Fase 4** — Tabla `client_pos_sessions` eliminada (estaba vacía, sin RPC ni edge function activas). No quedan referencias funcionales a `softwarepos.online` en `src/`.

## Pendiente

### Fase 3 — Hardening RBAC + telemetría
- Ocultar botón "Asignar rol" en `UsersTab` para usuarios sin `admin`/`superadmin` (evita el warning RLS visible en consola).
- Loggear cada login en `auth_login_events` (success/fail, provider, ip, ua).
- Unificar guards: hoy hay `RoleGuard` + chequeos ad-hoc; consolidar en un único `<RequireRole>` y `<RequireModule>`.

### Fase 2.5 — Vincular usuario demo
Cuando se cree `demo@sistecpos.com` en Auth:
```sql
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('59a4032f-3eeb-4312-a84a-f6d042f019ec', '<auth.uid>', 'admin')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role='admin';
INSERT INTO public.user_roles (user_id, role)
VALUES ('<auth.uid>', 'admin') ON CONFLICT DO NOTHING;
```
Endpoint sugerido: `/superadmin/reseed-demo` que ejecute esto vía edge function con service role.

### Fase 5 — Observabilidad
- Playwright e2e: login → `/clientes` → click "Entrar al POS" → URL = `/pos`.
- ESLint rule: prohibir literal `softwarepos.online` en `src/`.
- Wrapper `logger.ts` que envíe errores de consola a Sentry (o tabla `app_errors`).

## Documentación viva
- `mem://features/pos-native-login`
- `mem://features/demo-tenant-seed`
- `mem://features/post-license-onboarding`
- `mem://features/desktop-release-publishing` (pospuesta)
