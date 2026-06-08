# Arquitectura — Sistema de Acceso SistecPOS Core

> Plan aprobado en `.lovable/plan.md`. Este documento es la referencia técnica viva.

## Decisiones de configuración (runtime, no hardcode)

Todo lo configurable vive en la tabla `auth_settings` (singleton por organización) y se administra desde `/superadmin/seguridad/acceso`:

| Setting | Default | Notas |
|---|---|---|
| `methods_enabled` | `["passkey","google","password_totp","magic_link","recovery"]` | Habilita/inhabilita métodos |
| `require_2fa_roles` | `["superadmin","admin"]` | Roles obligados a tener 2FA |
| `enforce_2fa_grace_days` | `14` | Ventana antes de bloqueo |
| `superadmin_ip_allowlist` | `[]` (vacío = sin restricción) | CIDRs permitidos |
| `superadmin_requires_passkey` | `true` | |
| `break_glass_approvers` | `[]` (emails) | Mínimo 2 |
| `break_glass_method` | `"email_and_totp"` | `email` \| `email_and_totp` |
| `idle_timeout_minutes` | `{ superadmin: 15, admin: 60, editor: 240, user: 480 }` | Por rol |
| `reauth_window_minutes` | `5` | Step-up para acciones críticas |
| `rate_limit_per_15min` | `10` | Intentos por IP/email |

## Métodos soportados

Passkey (WebAuthn/FIDO2), Google OAuth managed, Email+Password+TOTP, Magic Link (email OTP), Recovery Codes (10, un solo uso), Break-glass Superadmin.

## Tablas (ver migración en `.lovable/pending-migrations/auth-system.sql`)

- `auth_settings` — config singleton
- `auth_factors` — TOTP/SMS/recovery (secrets cifrados AES-GCM con HKDF de `AUTH_ENCRYPTION_KEY`)
- `auth_webauthn_credentials`
- `auth_recovery_codes`
- `auth_login_events` — audit append-only, 180d
- `auth_superadmin_allowlist`
- `auth_break_glass_requests`

Todas con RLS + GRANTs (service_role full, authenticated solo lo propio).

## Edge Functions

`auth-login-challenge`, `auth-totp-{enroll,verify}`, `auth-recovery-{generate,consume}`, `auth-webauthn-{register,login}-{options,verify}`, `auth-break-glass-{request,approve}`, `auth-audit-log`.

Secret nuevo: `AUTH_ENCRYPTION_KEY` (32 bytes base64).

## Frontend `src/modules/auth/`

- `pages/Login.tsx` — selector dinámico según factores del email
- `pages/LoginSuperadmin.tsx` — ruta `/superadmin/acceso`
- `pages/Enroll2FA.tsx`, `EnrollPasskey.tsx`, `RecoveryCodes.tsx`, `Recover.tsx`
- `state/loginMachine.ts` — máquina de estados
- `lib/webauthn-client.ts` — wrapper `@simplewebauthn/browser`
- Panel admin `/superadmin/seguridad/acceso` para mutar `auth_settings`

## Guards

`RoleGuard` server-validated con `auth.getUser()` + RPC `current_role()`. Idle timeout y re-auth step-up configurables.

## Flujo

```
email → auth-login-challenge → lista de factores disponibles
      → UI elige el más fuerte → verifica → sesión + audit log
fallback: recovery code | magic link | break-glass (superadmin)
```

## Estado de implementación

- [x] Plan aprobado
- [x] Arquitectura documentada
- [ ] **Fase 0** — Auditoría `docs/auth/current-state.md`
- [ ] **Fase 1** — Migración base + audit log (bloqueado: Cloud caído)
- [ ] **Fase 2** — TOTP + recovery
- [ ] **Fase 3** — WebAuthn
- [ ] **Fase 4** — State machine
- [ ] **Fase 5** — Superadmin + break-glass
- [ ] **Fase 6** — Endurecimiento
- [ ] **Fase 7** — Migración usuarios
