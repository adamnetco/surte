# POS-AuthEmailValid

**Estado:** SHIPPED (con observación: verificación de bandeja real depende de propagación DNS — no bloquea)
**Owner:** Eduardo Tobacia
**Última actualización:** 2026-06-22

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
- [x] Aviso inline (`data-testid="email-notice"`) cuando se activa fallback o hay error.
- [x] Mensajes específicos para: usuario no existe, rate limit, backend intermitente.
- [x] Confirmación inline (`data-testid="email-sent-confirmation"`) diferencia magic-link vs recovery.
- [x] Recovery disparado para `demo@sistecpos.com` (HTTP 200).
- [x] E2E `e2e/auth-email-fallback.spec.ts` cubre validación, fallback mockeado y `/reset-password`.
- [ ] Verificar entrega real en bandeja demo (depende de DNS propagation).

## Notas
- Skill aplicada: `pos-emails`, `pos-spec`, `systematic-debugging`.
- Si en el futuro se reactiva OTP global, el fallback sigue siendo válido (no rompe nada).
