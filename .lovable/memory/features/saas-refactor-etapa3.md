---
name: SaaS Refactor Etapa 3 — Welcome notifications
description: Worker welcome-dispatcher + template organization-welcome + cron pg_cron 1 min
type: feature
---

## Etapa 3 completada (2026-06-11)

### Template email
`supabase/functions/_shared/transactional-email-templates/organization-welcome.tsx`
- Registrado en `registry.ts` como `'organization-welcome'`
- Props: `full_name, org_name, org_slug, invite_link, admin_url`
- Branding: primary `#0C4B83`, CTA `#F37021`, body `#ffffff`
- Subject dinámico: `Bienvenido a SistecPOS — <org_name> ya está activo`

### Worker `welcome-dispatcher`
- Lee `sync_outbox` con `target IN ('welcome_email','welcome_whatsapp')` y `status='pending'`, `next_attempt_at <= now()`
- Batch de 20
- `welcome_email` → invoca `send-transactional-email` con templateName `organization-welcome` e idempotencyKey `welcome-email-<outbox_id>`
- `welcome_whatsapp` → POST directo a YCloud `/v2/whatsapp/messages` con texto plano (regla del proyecto: sin emojis). Credenciales desde `app_settings` (`ycloud_api_key`, `ycloud_from_number`)
- Retry exponencial (2^attempts min, máx 60). Tras 5 intentos → `status='failed'`
- Éxito → `status='succeeded'`, `succeeded_at=now()`, guarda `_result` en payload
- ADMIN_URL configurable via secret `ADMIN_BASE_URL` (fallback `https://admin.sistecpos.com`)

### Cron
- pg_cron job `welcome-dispatcher-every-minute` (`* * * * *`)
- Llama via `net.http_post` con anon key
- Registrado vía `supabase--insert` (no migration) por contener URL/keys del proyecto
- Idempotente: `cron.unschedule` previo en bloque DO

### Pendiente Etapa 3
- Realtime UI en `/licencias` para mostrar status (sent/failed) por organización
- Botón "reenviar bienvenida" en superadmin que vuelve a encolar en sync_outbox
- Monitoreo de `sync_outbox WHERE target LIKE 'welcome_%' AND status='failed'`

### Notas
- Verificado: `POST /welcome-dispatcher` retorna `{processed:0, results:[]}` cuando no hay pendientes
- Próximo provisioning real disparará automáticamente las dos notificaciones
