# Runbook — Sistema de acceso SistecPOS Core

Guía operacional para llevar el sistema de acceso (auth refactor + Cloudflare multi-cuenta) de "borrador local" a producción cuando Lovable Cloud responda.

> **Plan completo:** `.lovable/plan.md` · **Arquitectura:** `docs/auth/architecture.md` · **Migración SQL:** `.lovable/pending-migrations/auth-system.sql` · **Tareas pendientes:** `.lovable/pending-cloud-tasks.md`

---

## 0. Pre-flight (cada vez que se reanude trabajo)

```bash
# 1. Verificar estado de Lovable Cloud
#    (usa la herramienta supabase--cloud_status desde el agente)
# Estado esperado: ACTIVE_HEALTHY
```

Si está `INACTIVE`/`PAUSING` → reanudar desde Project Settings → Cloud. Si está `INIT_FAILED` o sigue 403 → contactar soporte; no continuar.

---

## 1. Activar backend (orden estricto)

### 1.1 Crear secret `AUTH_ENCRYPTION_KEY`

Generar 32 bytes base64 localmente:

```bash
openssl rand -base64 32
```

Pegar el valor con `secrets--add_secret` cuando se solicite. **Guardar también en el password manager del equipo** (sin este secret no se pueden descifrar TOTP ni recovery codes futuros).

### 1.2 Aplicar migración base

Ejecutar el SQL de `.lovable/pending-migrations/auth-system.sql` a través de `supabase--migration`. Esperar aprobación del usuario. Incluye:

- `auth_settings` (singleton de configuración)
- `auth_factors` (TOTP/SMS/recovery — secrets AES-GCM)
- `auth_webauthn_credentials`
- `auth_recovery_codes`
- `auth_login_events` (audit append-only)
- `auth_superadmin_allowlist`
- `auth_break_glass_requests`
- `tenant_cloudflare_accounts` + columnas CF en `tenant_domains`

Todas con GRANTs + RLS + `has_role()` policies.

### 1.3 Seed inicial

Insertar fila default en `auth_settings` con los valores de `src/modules/auth/lib/authSettings.ts::DEFAULT_AUTH_SETTINGS`. Importar también los borradores del usuario actual:

```sql
-- correr SOLO si NO existe ya una fila
INSERT INTO public.auth_settings DEFAULT VALUES;
```

Luego desde el navegador del superadmin: abrir `/superadmin/seguridad/acceso` y pulsar **Guardar borrador** una vez para sincronizar el localStorage hacia DB (próximo PR: hook `useAuthSettings()` que detecta presencia de la tabla y migra).

### 1.4 Deploy edge functions

Las 12 stubs en `supabase/functions/auth-*` se despliegan automáticamente con cualquier cambio de código. Confirmar:

```
auth-login-challenge
auth-totp-{enroll,verify}
auth-recovery-{generate,consume}
auth-webauthn-{register,login}-{options,verify}
auth-break-glass-{request,approve}
auth-audit-log
```

Cada una devuelve `503 auth_subsystem_not_ready` hasta que se implementen. La UI ya las consume con fallback. Implementar en este orden:

1. `auth-login-challenge` (desbloquea selector de método)
2. `auth-totp-enroll` + `auth-totp-verify` (mínimo viable de 2FA)
3. `auth-webauthn-*` (passkeys)
4. `auth-recovery-*`
5. `auth-break-glass-*`
6. `auth-audit-log`

### 1.5 Cloudflare

#### 1.5a Crear secret `CLOUDFLARE_API_TOKEN` (cuenta SaaS de Sistecpos)

Scope: `Zone.SSL and Certificates:Edit`, `Zone.Custom Hostnames:Edit`, `Zone.DNS:Edit`.

#### 1.5b Crear secret `CLOUDFLARE_FALLBACK_ZONE_ID`

ID de la zona donde se crean los Custom Hostnames por defecto (modo SaaS).

#### 1.5c Crear edge functions

```
supabase/functions/cloudflare-domain-connect/index.ts
supabase/functions/cloudflare-domain-status/index.ts
```

Reemplazar `mockConnect` / `mockAdvanceStatus` en `src/modules/superadmin/lib/cloudflareDrafts.ts` por llamadas reales:

```ts
const { data } = await supabase.functions.invoke("cloudflare-domain-connect", {
  body: { domain_id: domain.id },
});
```

#### 1.5d Migrar borradores locales

Los superadmins que usaron la pestaña Cloudflare durante el período offline deben:

1. Abrir `/superadmin/sitios?tab=cloudflare`
2. **Re-introducir el API token completo** (solo se guardó enmascarado)
3. Marcar default
4. Pulsar **Guardar** — ahora persiste cifrado en `tenant_cloudflare_accounts`

---

## 2. Verificación post-deploy

```bash
# Smoke tests (desde el agente)
supabase--curl_edge_functions POST /auth-login-challenge { "email": "eduardotp77@gmail.com" }
# esperar: 200 con factors[]; NO 503

supabase--read_query "SELECT * FROM auth_settings LIMIT 1"
# esperar: una fila con valores default

supabase--read_query "SELECT count(*) FROM auth_login_events WHERE event_type='login_attempt' AND created_at > now() - interval '1 hour'"
# esperar: > 0 tras el primer login real
```

Apagar `VITE_DEV_BYPASS_AUTH=1` en `.env.local` y confirmar que `/login` funciona con la cuenta real.

---

## 3. Migración de usuarios existentes (Fase 7)

Estrategia gradual basada en `enforce_2fa_grace_days` (default 14):

1. Día 0: deploy completo. Banner global "Activa 2FA en N días" para roles en `require_2fa_roles`.
2. Día 1-13: usuarios pueden hacer login normal, pero al entrar se les fuerza pasar por `/enroll/2fa` o `/enroll/passkey`.
3. Día 14+: hard-block. Sin 2FA = sin sesión. Solo recovery codes o break-glass.

Tracking SQL:

```sql
SELECT
  ur.role,
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM auth_factors af WHERE af.user_id = ur.user_id AND af.verified)) AS enrolled,
  COUNT(*) AS total
FROM user_roles ur
WHERE ur.role IN ('superadmin','admin')
GROUP BY ur.role;
```

---

## 4. Break-glass — procedimiento manual

Cuando un superadmin pierde acceso a passkey + TOTP + recovery codes:

1. Otro superadmin (o el aprobador definido en `break_glass_approvers`) abre `/superadmin/seguridad/acceso` → tab "Break-glass".
2. Genera una **request** desde la UI (o `supabase.functions.invoke('auth-break-glass-request', { body: { email } })`).
3. Los aprobadores reciben email con código de 6 dígitos. Mínimo 2 deben aprobar dentro de 5 min.
4. El usuario afectado recibe magic link single-use con validez de 5 min.
5. Al usarlo, se le obliga a reenrolarse 2FA inmediatamente.
6. **Auditoría:** evento `break_glass_used` queda en `auth_login_events` y notifica a TODOS los superadmins.

---

## 5. Rollback

Si algo falla post-deploy:

1. `VITE_DEV_BYPASS_AUTH=1` en `.env.local` → restaura acceso superadmin local.
2. Revertir las edge functions auth-* a stubs (commit anterior).
3. Las tablas `auth_*` pueden quedar — los datos no estorban; solo el código las usa.
4. Avisar a usuarios afectados vía WhatsApp (template plano, sin emojis).

---

## 6. Checklist final

- [ ] `AUTH_ENCRYPTION_KEY` creado y guardado en password manager
- [ ] Migración aplicada (8 tablas + GRANTs + RLS)
- [ ] `auth_settings` con una fila default
- [ ] 12 edge functions auth-* implementadas (no stubs)
- [ ] 2 edge functions cloudflare-* implementadas
- [ ] `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_FALLBACK_ZONE_ID` configurados
- [ ] Cuentas Cloudflare migradas desde localStorage a DB
- [ ] Superadmin master (`eduardotp77@gmail.com`) tiene passkey + TOTP + recovery codes guardados
- [ ] Mínimo 2 aprobadores break-glass configurados
- [ ] `VITE_DEV_BYPASS_AUTH` removido de `.env.local`
- [ ] Smoke tests pasan
- [ ] Banner de gracia 2FA activo

---

## 7. Referencias

- Plan: `.lovable/plan.md`
- Arquitectura: `docs/auth/architecture.md`
- Migración: `.lovable/pending-migrations/auth-system.sql`
- Tareas pendientes: `.lovable/pending-cloud-tasks.md`
- Memoria: `mem://auth/access-system`
- Tests: `src/modules/auth/{state,lib}/*.test.ts`, `src/modules/superadmin/lib/cloudflareDrafts.test.ts`
