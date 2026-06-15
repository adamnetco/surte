# POS-RecoveryMailFuncional

**Estado:** SHIPPED
**Módulo:** auth / superadmin
**Owner:** Eduardo Tobacia
**Última actualización:** 2026-06-15

## Problema
1. Al crear una organización (edge function `tenant-create-with-owner`) se crea un usuario **owner** con una contraseña aleatoria generada en servidor. El owner no recibe ningún email para fijar su propia contraseña, por lo que depende de que el superadmin copie/pegue la credencial — frágil y poco profesional.
2. Cuando un usuario existente intenta recuperar acceso desde `/reset-password`, el correo **no siempre llega** porque la pantalla mostraba branding de "SURTÉ" (logo `surte-logo.png`) en vez de SistecPOS, generando desconfianza y rebotes a soporte.
3. La marca **SistecPOS** debe ser consistente en TODA la experiencia de login: `LoginRouter`, `ResetPassword`, `LoginSuperadmin`.

## URLs del flujo de acceso
| Ruta | Componente | Propósito |
|---|---|---|
| `/` (admin/app/www) | `LoginRouter` (vía `TenantHome`) | Portal SaaS unificado |
| `/login`, `/user/login`, `/admin/login` | `TenantAwareLogin` → `LoginRouter` o `Login` (storefront) | Acceso según host |
| `/reset-password` | `ResetPassword` | Solicitar y consumir enlace de recuperación |
| `/superadmin/acceso` | `LoginSuperadmin` | Acceso restringido al superadmin maestro |
| `/auth-status`, `/admin/auth-status` | `AuthStatus` (`MasterOnlyGuard`) | Diagnóstico, solo superadmin maestro |

## Criterios de aceptación
- [x] **AC1**: `tenant-create-with-owner` dispara `resetPasswordForEmail` para el owner recién creado (no para owners existentes) usando el cliente anon → activa `auth-email-hook` → email branded SistecPOS desde `notify.surteya.com`.
- [x] **AC2**: La respuesta de `tenant-create-with-owner` incluye `recovery_email_sent: boolean` y `recovery_redirect_to: string` para que la UI confirme al superadmin que el owner recibirá instrucciones.
- [x] **AC3**: `ResetPassword.tsx` reemplaza el logo `surte-logo.png` y el texto "SURTÉ" por el branding SistecPOS (gradiente + Sparkles + nombre), consistente con `LoginRouter`.
- [x] **AC4**: Si el tenant tiene `organization.logo_url` configurado, `ResetPassword` lo prefiere y cae a SistecPOS solo cuando no hay logo del tenant — branding por `id_organizacion`.
- [x] **AC5**: El email de recovery apunta a `/reset-password?tienda=<slug>` para preservar contexto multi-tenant.
- [x] **AC6**: Validado — `email_send_log` muestra `recovery` + `magiclink` con `status=sent` para `demo@sistecpos.com` (último 2026-06-12 13:50:51 UTC, sin `error_message`).

## Notas técnicas
- No se cambia el flujo de magic-link fallback (ya cubierto por `POS-auth-email-valid`).
- No tocar `auth-email-hook` (templates ya están desplegados).
- Skills aplicadas: `pos-spec`, `pos-feature`, `pos-emails`.
