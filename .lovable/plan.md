# Plan: Refactor y endurecimiento del sistema de acceso — SistecPOS Core

## 1. Objetivos

1. **Cero pérdida de acceso**: múltiples métodos de login + factores de recuperación redundantes.
2. **2FA obligatorio para Superadmin/Admin**, opcional para Editor/User.
3. **FIDO2/WebAuthn (passkeys)** como método primario sin contraseña.
4. **Superadmin blindado**: ruta segregada, allowlist por email + IP opcional + passkey obligatoria.
5. **Server-side key custody**: claves privadas (TOTP secret, WebAuthn credentials, recovery hashes) nunca expuestas al cliente.
6. **UX rápida**: mobile-first, login en ≤ 2 toques con passkey; fallback claro si falla un método.

## 2. Estado actual (a auditar antes de codificar)

- `lovable.auth` (Google OAuth managed) + email/password Supabase.
- RLS basada en `has_role(uid, role)` con `user_roles` (superadmin > admin > editor > user).
- `handle_new_user` enlaza guest orders.
- HIBP habilitado.
- No hay 2FA, ni WebAuthn, ni recovery codes, ni audit log de login.

Salida del descubrimiento: documento `docs/auth/current-state.md` con inventario de hooks (`useAuth`), guards, rutas y edge functions que tocan sesión.

## 3. Métodos de acceso soportados (matriz final)


| Método                                                             | Primario | Fallback  | Roles permitidos |
| ------------------------------------------------------------------ | -------- | --------- | ---------------- |
| Passkey (WebAuthn/FIDO2)                                           | ✅        | —         | Todos            |
| Google OAuth (managed)                                             | ✅        | —         | Todos            |
| Email + Password + TOTP                                            | ✅        | ✅         | Todos            |
| Magic Link (email OTP 6 dígitos)                                   | —        | ✅         | Todos            |
| SMS OTP (WhatsApp via YCloud)                                      | —        | ✅         | User/Editor      |
| Recovery Codes (10 × un solo uso)                                  | —        | ✅ rescate | Todos            |
| **Superadmin Break-glass** (sobre cifrado offline + 2 aprobadores) | —        | ✅ crítico | Superadmin       |


## 4. Arquitectura

### 4.1 Tablas nuevas (migración con GRANTs + RLS)

- `auth_factors` — `user_id`, `type` (`totp|webauthn|recovery|sms`), `secret_encrypted`, `metadata jsonb`, `last_used_at`, `verified_at`.
- `auth_webauthn_credentials` — `credential_id`, `public_key`, `counter`, `transports`, `device_label`, `aaguid`.
- `auth_recovery_codes` — `user_id`, `code_hash`, `used_at`.
- `auth_login_events` — `user_id`, `method`, `ip`, `ua`, `success`, `risk_score`, `created_at` (append-only, retención 180d).
- `auth_superadmin_allowlist` — `email`, `enforced_ip_cidr nullable`, `requires_passkey bool default true`.
- `auth_break_glass_requests` — `requester_email`, `approver1`, `approver2`, `expires_at`, `consumed_at`.

Todas con `GRANT` a `service_role` y `authenticated` (solo SELECT del propio user via RLS).

### 4.2 Edge Functions (verify_jwt según caso)

- `auth-webauthn-register-options` / `auth-webauthn-register-verify`
- `auth-webauthn-login-options` / `auth-webauthn-login-verify` → emite sesión via `supabase.auth.admin.generateLink` o token custom.
- `auth-totp-enroll` (genera secret cifrado AES-GCM con `LICENSE_MASTER_KEY` derivado) / `auth-totp-verify`.
- `auth-recovery-generate` (10 códigos, devuelve 1 vez) / `auth-recovery-consume`.
- `auth-login-challenge` orquestador: decide método según factor del usuario.
- `auth-break-glass-request` / `auth-break-glass-approve`.
- `auth-audit-log` (cliente envía evento; función firma y persiste).

Secret nuevo requerido: `AUTH_ENCRYPTION_KEY` (32 bytes base64) para cifrar TOTP secrets en reposo.

### 4.3 Frontend

```
src/modules/auth/
  pages/
    Login.tsx              # selector de método (passkey > google > password)
    LoginSuperadmin.tsx    # ruta /superadmin/login segregada
    Enroll2FA.tsx
    EnrollPasskey.tsx
    RecoveryCodes.tsx
    Recover.tsx            # flujo de rescate
  components/
    MethodPicker.tsx
    TotpInput.tsx
    PasskeyButton.tsx
    RecoveryCodeInput.tsx
  hooks/
    useWebAuthn.ts
    useTotp.ts
    useLoginFlow.ts        # state machine xstate-like
  lib/
    webauthn-client.ts     # @simplewebauthn/browser wrapper
    risk.ts                # device fingerprint ligero
  state/
    loginMachine.ts
```

State machine: `idle → identify → choose_factor → verify_factor → [2fa] → session_ready | recovery`.

### 4.4 Guards y sesión

- `CartNavigationGuard` se mantiene.
- Nuevo `RoleGuard` server-validated: en cada navegación a área protegida, llama `auth.getUser()` (no `getSession()`) + RPC `current_role()`.
- Idle timeout configurable por rol (Superadmin 15 min, Admin 60 min, otros 8 h).
- Re-auth step-up para acciones críticas (cambio de roles, secrets, break-glass): exige passkey o TOTP en los últimos 5 min.

### 4.5 Superadmin (Eduardo Tobacia)

- Ruta `/superadmin/acceso` (no enlazada en UI pública).
- Requiere: email en allowlist + passkey + TOTP + (opcional) IP en CIDR.
- Sin password directo. Recovery solo vía break-glass.
- Break-glass: dos aprobadores (Admins definidos) reciben email Resend con link firmado de 10 min; al aprobar ambos, se emite un single-use magic link de 5 min al superadmin y se notifica a todos los superadmins.

## 5. UX (mobile-first)

- **Login screen**: input email → backend responde con factores disponibles → muestra botón primario según el más fuerte registrado (passkey > totp+pwd > google > magic link).
- **Skeletons** durante challenge.
- **Mensajes claros** de fallback ("Tu passkey no funcionó, prueba con código de recuperación").
- **Onboarding 2FA** obligatorio post-primer-login para admin/superadmin con barra de progreso.
- Vista `/mi/seguridad`: lista de factores, dispositivos passkey, sesiones activas, últimos 10 logins, botón revocar.

## 6. Diagrama de flujo (login estándar)

```text
[Email] -> identify -> ¿passkey? --sí--> WebAuthn --ok--> sesión
                              \--no--> ¿totp?  --sí--> pwd + totp --> sesión
                                              \--no--> ¿google? --sí--> OAuth --> sesión
                                                              \--no--> magic link email
fallo x3 -> bloquear 15 min + sugerir recovery codes
```

## 7. Fases de implementación (vertical slices)

### Fase 0 — Discovery & audit (sin código)

- Mapear `useAuth`, guards, rutas; documentar.
- Confirmar Cloud arriba (las migraciones requieren backend).
- Salida: `docs/auth/current-state.md`.

### Fase 1 — Fundaciones DB + audit log

- Migración: `auth_factors`, `auth_login_events`, `auth_superadmin_allowlist` con RLS + GRANTs.
- Edge function `auth-audit-log` + hook cliente que registra cada `signIn/signOut`.
- Checkpoint: eventos visibles en `/superadmin/auditoria-acceso`.

### Fase 2 — TOTP + Recovery Codes

- Tablas + EF de enroll/verify/consume.
- UI `Enroll2FA.tsx` (QR + verificación) y `RecoveryCodes.tsx` (descarga PDF + copia).
- Enforcement opcional por rol vía flag en `user_roles`.
- Checkpoint: admin puede activar y rescatar con código.

### Fase 3 — WebAuthn / Passkeys

- Instalar `@simplewebauthn/browser` + server (Deno port o implementación nativa Web Crypto).
- EFs register/login + tabla.
- UI `EnrollPasskey.tsx` y botón en `Login.tsx`.
- Checkpoint: login passwordless funciona en iOS Safari, Android Chrome, desktop.

### Fase 4 — State machine de login y método dinámico

- `loginMachine.ts` (xstate o reducer propio).
- Refactor `Login.tsx` para usar la máquina.
- Idle timeout por rol + re-auth step-up.
- Checkpoint: flujo único maneja todos los métodos.

### Fase 5 — Superadmin segregado + break-glass

- Ruta `/superadmin/acceso`, allowlist, enforcement passkey+TOTP+IP.
- Tabla y EFs de break-glass + emails Resend.
- Checkpoint: simulacro de recuperación con 2 aprobadores.

### Fase 6 — Endurecimiento

- Rate limit (Upstash o tabla `auth_rate_limit` con función Postgres).
- HIBP ya activo; añadir bloqueo de contraseñas reutilizadas (últimas 5 hashes).
- Headers de seguridad y CSP estricto.
- Pruebas de penetración manuales: fuzz endpoints, replay challenges.
- Checkpoint: `supabase--linter` limpio y scan de seguridad sin highs.

### Fase 7 — Migración de usuarios existentes

- Script: para cada usuario activo, forzar enrolment de 2FA en próximo login (admins) o invitar (resto).
- Email masivo con instrucciones (template Resend).
- Ventana de 14 días; tras eso, admins sin 2FA quedan en estado `must_enroll`.

## 8. Detalles técnicos clave

- **Cifrado de secrets**: TOTP secret y WebAuthn challenges → AES-GCM con key derivada (HKDF) de `AUTH_ENCRYPTION_KEY` + `user_id` salt.
- **Sesiones**: Supabase JWT (httpOnly cuando proxy lo permita; en SPA, almacenamiento por defecto pero con refresh rotation + revoke en `auth_login_events` anómalos).
- **Risk scoring** simple: nuevo device/UA/IP suma puntos → fuerza 2FA aunque sea opcional.
- **Memoria**: documentar en `mem://auth/access-system` el nuevo modelo + factores + rutas.

## 9. Riesgos y mitigaciones


| Riesgo                                       | Mitigación                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Cloud caído impide migraciones               | Tareas quedan en `/superadmin/cloud-tareas`, ejecutar al volver                                                 |
| Usuario pierde dispositivo passkey y códigos | Break-glass con 2 aprobadores                                                                                   |
| Bug bloquea a todos los admins               | Superadmin allowlist + break-glass + script CLI de rescate (Edge Function con `service_role` y secret separado) |
| WebAuthn en navegadores viejos               | Fallback automático a TOTP/magic link                                                                           |
| Migración masiva genera fricción             | Onboarding gradual + tutorial in-app                                                                            |


## 10. Entregables

1. `docs/auth/current-state.md` (Fase 0)
2. `docs/auth/architecture.md` (este plan + diagramas)
3. Migraciones SQL (Fases 1–5)
4. Edge functions auth-* (Fases 1–5)
5. Módulo `src/modules/auth/` refactorizado
6. `/superadmin/auditoria-acceso` y `/mi/seguridad`
7. Memoria `mem://auth/access-system`
8. Plan de pruebas: matriz por método × rol × dispositivo

## 11. Aprobaciones requeridas antes de codificar

1. ¿Confirmas WebAuthn + TOTP + Recovery como núcleo (vs solo TOTP)? R:// si, confirmo varias opciones WebAuthn + TOTP + Recovery como nucleo, panel de gestion para por configuracion decidir
2. ¿Quiénes son los 2 aprobadores de break-glass del superadmin? R:// email y TOTP, por configuración decidir
3. ¿Activamos enforcement obligatorio 2FA para admin/superadmin desde día 1, o tras ventana de 14 días? por configuracion decidir
4. ¿IP allowlist para superadmin: sí, no, u opcional por configuración? por configuración decidir.
5. ¿Apruebas crear el secret `AUTH_ENCRYPTION_KEY` cuando Cloud responda? si

Tras tu OK arranco con Fase 0 (auditoría sin código) y dejo Fases 1+ encoladas en `/superadmin/cloud-tareas` hasta que el backend responda.