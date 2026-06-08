---
name: Access System Architecture
description: Multi-method login (passkey/google/totp/magic-link/recovery), 2FA, superadmin break-glass, all runtime-configurable via auth_settings
type: feature
---

# Sistema de acceso

Plan completo en `.lovable/plan.md`, arquitectura en `docs/auth/architecture.md`, migración pendiente en `.lovable/pending-migrations/auth-system.sql`.

## Reglas

- **Todo configurable vía `auth_settings`** (singleton). Nada hardcoded: métodos, enforcement, IP allowlist, timeouts, aprobadores break-glass.
- Roles obligados a 2FA por default: `superadmin`, `admin` (modificable).
- Superadmin: ruta segregada `/superadmin/acceso`, passkey + TOTP, allowlist email + IP opcional.
- Break-glass: 2 aprobadores (email + TOTP por config), single-use magic link 5 min, notifica a todos los superadmins.
- Secrets cifrados con `AUTH_ENCRYPTION_KEY` (HKDF + AES-GCM).
- Audit log append-only en `auth_login_events`, retención 180d.
- Panel admin: `/superadmin/seguridad/acceso` para mutar settings.
- Re-auth step-up para acciones críticas (cambio roles, secrets, break-glass).

## Edge functions

`auth-login-challenge` (orquestador), `auth-totp-{enroll,verify}`, `auth-recovery-{generate,consume}`, `auth-webauthn-{register,login}-{options,verify}`, `auth-break-glass-{request,approve}`, `auth-audit-log`.

## Frontend

`src/modules/auth/` — pages, hooks, state machine `loginMachine.ts`, `webauthn-client.ts` (`@simplewebauthn/browser`).

## Pendiente al volver Cloud

1. Crear secret `AUTH_ENCRYPTION_KEY` (32 bytes base64).
2. Aplicar `.lovable/pending-migrations/auth-system.sql` con `supabase--migration`.
3. Desplegar edge functions auth-*.
4. Construir UI siguiendo fases del plan.
