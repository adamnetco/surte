# email

Cliente de envío de correos (Resend vía edge function) y plantillas HTML.

## Estructura
- `mailService.ts` — wrapper sobre `send-transactional-email` / Resend.
- `emailTemplates.ts` — plantillas HTML (welcome, orderConfirmation, etc.).

## Reglas
- Importar SIEMPRE vía `@/modules/email` (sin deep imports).
- Las plantillas deben mantener HTML inline; no usar CSS externo.
- El envío real ocurre en `supabase/functions/send-transactional-email`.
- No depende de otros módulos; sólo de `@/integrations/supabase/client`.

## Siguiente módulo sugerido
`tenant` (resolveTenant + tenantScope + subdomain helpers).
