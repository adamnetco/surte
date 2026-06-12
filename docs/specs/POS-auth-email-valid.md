# POS-AuthEmailValid

**Estado:** IN_BUILD
**Owner:** Eduardo Tobacia
**Última actualización:** 2026-06-12

## Problema
En `LoginRouter`, el botón "Enviar acceso por email" falla con `Signups not allowed for otp` en proyectos donde el OTP de Supabase está deshabilitado (configuración por defecto de SistecPOS para evitar self-signup). Resultado: usuarios legítimos (incl. `demo@sistecpos.com`) no pueden entrar si no recuerdan la contraseña.

## Alcance
- Módulo: `auth` (`src/modules/auth/pages/LoginRouter.tsx`, `ResetPassword.tsx`).
- Emails: usa infra existente (`notify.surteya.com` verificado, `auth-email-hook` ya desplegado).
- No toca DB.

## Criterios de aceptación
1. Si `signInWithOtp` devuelve `Signups not allowed for otp` (u otro error de OTP/signup deshabilitado), el botón cae automáticamente a `resetPasswordForEmail` apuntando a `/reset-password`.
2. El usuario recibe email branded (template `recovery`) desde `notify.surteya.com`.
3. `/reset-password` permite fijar nueva contraseña y luego entrar normalmente.
4. Toast informa correctamente si fue magic-link u "enlace para crear/restablecer contraseña".
5. Logs en `authLog` registran `magic_link_fallback_recovery` para auditoría.

## Estado actual
- [x] Fallback OTP → recovery implementado en `LoginRouter.handleEmailLink`.
- [x] Recovery disparado manualmente para `demo@sistecpos.com` (HTTP 200).
- [x] Templates de auth-email-hook ya activos (notify.surteya.com).
- [ ] Verificar entrega en bandeja demo (depende de DNS propagation).

## Notas
- Skill aplicada: `pos-emails`, `pos-spec`, `systematic-debugging`.
- Si en el futuro se reactiva OTP global, el fallback sigue siendo válido (no rompe nada).
