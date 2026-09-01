---
name: Accesos y credenciales por tenant
description: Flujo único para crear cuentas, asignarlas a una tienda con rol y definir contraseña explícita (tenant-access-manage)
type: feature
---
Toda la gestión de accesos de un tenant pasa por la edge function
`tenant-access-manage` (acciones `create_member`, `set_password`, `deactivate`).

- Autorización: superadmin global u owner/admin **activo** de la organización.
  El owner solo lo toca el owner o un superadmin.
- Cada acción escribe en `tenant_audit_log`
  (`tenant_member_created`, `tenant_member_password_set`, `tenant_member_deactivated`).
- Rol global (`user_roles`) derivado del rol de tienda:
  owner/admin→admin, manager→editor, cashier→cashier, agent→agente, resto→user.
- Política de contraseña: 8–72 caracteres, al menos una letra y un número.

`tenant-create-with-owner` acepta `owner_password` opcional. Si viene, se aplica
directamente (también sobre una cuenta existente) y **no** se envía correo de
recuperación — imprescindible para poder entrar al POS local recién compilado.
Si no viene, se genera una y se devuelve en `generated_password`.

UI: `CreateMemberDialog` + `SetPasswordButton` en la pestaña de miembros del
admin; adaptador en `src/modules/admin-cms/services/tenantAccess.ts`.
`ResetPasswordButton` (correo) se conserva como alternativa.
