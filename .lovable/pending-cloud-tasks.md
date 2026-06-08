# Tareas pendientes — ejecutar cuando Lovable Cloud vuelva

**Estado backend:** caído desde ~2026-06-08 00:30Z. `auth/v1/health` y `read_query` devuelven timeout. No se puede correr migración, insert, ni desplegar edge functions hasta recuperar.

**Decisiones del usuario (ya confirmadas):**
- Cloudflare: **Ambos** (SaaS por defecto, multi-cuenta opcional).
- Tareas: **scaffold ahora, ejecutar al volver**.
- Dominio `surteya.com`: registrado, **DNS en Cloudflare (cuenta del cliente)**.

---

## 1. Migración (Test → al publicar va a Live)

```sql
-- 1.1 Columnas Cloudflare en tenant_domains
ALTER TABLE public.tenant_domains
  ADD COLUMN IF NOT EXISTS dns_mode TEXT NOT NULL DEFAULT 'saas'
    CHECK (dns_mode IN ('saas','cloudflare_account','manual')),
  ADD COLUMN IF NOT EXISTS cf_zone_id TEXT,
  ADD COLUMN IF NOT EXISTS cf_account_id UUID,
  ADD COLUMN IF NOT EXISTS cf_hostname_id TEXT,
  ADD COLUMN IF NOT EXISTS cf_status TEXT,
  ADD COLUMN IF NOT EXISTS cf_ssl_status TEXT,
  ADD COLUMN IF NOT EXISTS cf_dcv_method TEXT DEFAULT 'txt',
  ADD COLUMN IF NOT EXISTS cf_ownership_verification JSONB,
  ADD COLUMN IF NOT EXISTS cname_target TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- 1.2 Tabla multi-cuenta CF
CREATE TABLE IF NOT EXISTS public.tenant_cloudflare_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  label TEXT NOT NULL,
  cf_account_id TEXT NOT NULL,
  cf_zone_id TEXT,
  api_token_encrypted TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_cloudflare_accounts TO authenticated;
GRANT ALL ON public.tenant_cloudflare_accounts TO service_role;
ALTER TABLE public.tenant_cloudflare_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage cf accounts"
  ON public.tenant_cloudflare_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_cf_accounts_one_default_per_org
  ON public.tenant_cloudflare_accounts(organization_id) WHERE is_default;

CREATE TRIGGER tg_cf_accounts_set_updated_at
  BEFORE UPDATE ON public.tenant_cloudflare_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## 2. Seed `demo` tenant (insert tool, no migración)

Crear organización con slug `demo` + 3–5 productos públicos y categoría demo. Usar como reemplazo en `LoginRouter.tsx` en lugar de `surteya`.

```sql
INSERT INTO public.organizations (slug, name, environment, is_active)
VALUES ('demo','Tienda Demo','development', true)
ON CONFLICT (slug) DO NOTHING;
-- replicar a Live con environment:"production"
```

## 3. Secrets a pedir (`secrets--add_secret`)

- `CLOUDFLARE_API_TOKEN` (token global de la cuenta SaaS de Sistecpos, scope Zone.SSL+Hostname+DNS).
- `CLOUDFLARE_FALLBACK_ZONE_ID` (zone donde se crean Custom Hostnames por defecto).

## 4. Edge functions a crear

- `supabase/functions/cloudflare-domain-connect/index.ts`
  - Input: `{ domain_id }`. Lee tenant_domains, según `dns_mode`:
    - `saas`: POST `/zones/{CLOUDFLARE_FALLBACK_ZONE_ID}/custom_hostnames` con `ssl.method=txt`.
    - `cloudflare_account`: usa token de `tenant_cloudflare_accounts` por org.
  - Persiste `cf_hostname_id`, `cf_ownership_verification`, `cname_target`.
- `supabase/functions/cloudflare-domain-status/index.ts`
  - GET hostname, actualiza `cf_status`, `cf_ssl_status`, `verified_at`, `last_checked_at`.
- Añadir bloques en `supabase/config.toml`:
  ```
  [functions.cloudflare-domain-connect]
    verify_jwt = true
  [functions.cloudflare-domain-status]
    verify_jwt = true
  ```

## 5. UI — `src/modules/superadmin/pages/Sitios.tsx`

Wizard 3 pasos en `DomainsTab`:
1. Dominio + modo (SaaS / cuenta CF propia).
2. Mostrar CNAME (`cname_target`) y TXT DCV (`cf_ownership_verification`).
3. Botón "Verificar" → invoca `cloudflare-domain-status`, barra `<Progress>` con `cf_ssl_status` (pending_validation → pending_issuance → active).

Nueva sub-tab "Cuentas Cloudflare" para CRUD de `tenant_cloudflare_accounts`.

## 6. Ocultar pantalla de friction y reemplazar enlaces

En `LoginRouter.tsx` ya se quitaron los enlaces a `surteya`. Cuando exista `demo`, cambiar referencias a `/demo`.

## 7. Registrar surteya.com

Una vez todo arriba, insertar fila en `tenant_domains` para el site de Surteya:
```sql
INSERT INTO tenant_domains (site_id, organization_id, hostname, dns_mode, is_primary)
VALUES ('<site_id_surteya>','<org_surteya>','surteya.com','cloudflare_account', true);
```
Luego ejecutar wizard desde el panel.

## 8. Publicar a Live

Schema + edge functions + secrets se copian. Repetir seed `demo` con `environment:"production"`.

---

**Cómo reanudar:** decir "continúa con las tareas pendientes" y el agente ejecuta secciones 1→8 en orden, esperando aprobación de migración y secretos donde aplique.

---

## 5. Sistema de acceso (refactor completo) — plan aprobado 2026-06-08

Plan: `.lovable/plan.md` · Arquitectura: `docs/auth/architecture.md` · Migración: `.lovable/pending-migrations/auth-system.sql` · Memoria: `mem://auth/access-system`

**Decisiones del usuario:**
- WebAuthn + TOTP + Recovery como núcleo, **todo configurable** desde panel admin (`auth_settings`).
- Break-glass superadmin con aprobadores definidos por configuración (email + TOTP).
- Enforcement 2FA: por configuración (default 14 días gracia para admin/superadmin).
- IP allowlist superadmin: por configuración (default vacío).
- Crear secret `AUTH_ENCRYPTION_KEY` cuando Cloud responda.

**Orden de ejecución al volver Cloud:**
1. `secrets--add_secret AUTH_ENCRYPTION_KEY` (32 bytes base64).
2. `supabase--migration` con SQL de `.lovable/pending-migrations/auth-system.sql`.
3. Implementar edge functions auth-* (stubs por crear).
4. Construir Fases 2-7 según plan (UI, state machine, break-glass, hardening, migración usuarios).

## 6. Avance frontend (sin Cloud)

Construido y listo para conectar cuando Cloud responda:

- `src/modules/auth/state/loginMachine.ts` — reducer puro + `pickStrongest()`. 5 tests verdes.
- `src/modules/auth/hooks/useLoginFlow.ts` — orquesta el reducer y llama a `auth-login-challenge` (con fallback si Cloud está caído).
- `src/modules/auth/lib/webauthn-client.ts` — wrapper nativo `navigator.credentials` (sin dependencia externa).
- Componentes UI: `MethodPicker`, `PasskeyButton`, `TotpInput`, `RecoveryCodeInput`.
- Página `src/modules/auth/pages/LoginSuperadmin.tsx` montada en `/superadmin/acceso`.
- Barrel `@/modules/auth` re-exporta `useLoginFlow`, `loginReducer`, `LoginSuperadminPage`.

Cuando Cloud vuelva:
1. Crear secret `AUTH_ENCRYPTION_KEY`.
2. Aplicar `.lovable/pending-migrations/auth-system.sql`.
3. Desplegar edge functions `auth-login-challenge`, `auth-totp-*`, `auth-webauthn-*`, `auth-recovery-*`, `auth-break-glass-*`.
4. Reemplazar el `onVerify(false, ...)` del prototipo por las llamadas reales.
