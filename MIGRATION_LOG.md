# MIGRATION LOG — sistecpos-colombia → sistecposcore

Registro de migración del módulo **Clientes** y de la arquitectura **multi-dominio**
hacia `sistecposcore`.

---

## Fase 1 — Subdomain Router + esqueleto (completada)

### Archivos creados / modificados
- `src/lib/subdomain.ts` — `detectTenant()` por hostname + override `?tenant=`.
- `src/components/clientes/ClientPortalShell.tsx` — placeholder (ahora re-exporta `ClientPortal`).
- `src/App.tsx` — rutas `/clientes`, `/user/login`, `/admin/login`; `/` resuelve por tenant.

### Mapeo subdominio → vista raíz
| Host                    | Tenant  | Componente en `/`                 |
|-------------------------|---------|-----------------------------------|
| `admin.sistecpos.com`   | `admin` | `AdminDashboard`                  |
| `mi.sistecpos.com`      | `mi`    | `ClientPortalShell` → `ClientPortal` |
| `pos.sistecpos.com`     | `pos`   | `POSWorkspace`                    |
| `app.sistecpos.com`     | `app`   | `Index`                           |
| `sistecpos.com` / `www` | `www`   | `Index`                           |
| dev (`localhost`)       | `app`   | override con `?tenant=mi`         |

---

## Fase 2 — Migración UI Clientes (completada ✅)

### Componentes copiados desde `sistecpos-colombia/src/components/clientes/`
Todos viven ahora en `src/components/clientes/`:

- [x] `ClientPortal.tsx` (orquestador con tabs lazy-loaded)
- [x] `ClientDashboardTab.tsx`
- [x] `ClientSubscriptionTab.tsx`
- [x] `ClientTicketsTab.tsx`
- [x] `ClientBillingTab.tsx`
- [x] `ClientContractsTab.tsx`
- [x] `ClientTrainingsTab.tsx`
- [x] `ClientDownloadsTab.tsx`
- [x] `ClientPOSAccess.tsx`
- [x] `ClientPOSLogin.tsx`
- [x] `TicketChatView.tsx`
- [x] `ClientPortalShell.tsx` → re-export de `ClientPortal`

### Adaptaciones aplicadas
1. **AuthContext**: `@/hooks/useAuth` → `@/context/AuthContext` en todos los componentes.
2. **Tablas no migradas** (Fase 3): se envuelven en `(supabase as any).from(...)` para
   evitar errores de TypeScript. En runtime devolverán error y los componentes
   mostrarán su estado vacío. Tablas pendientes:
   - `client_tickets`, `ticket_messages`, `client_pos_sessions`
   - `client_downloads`, `contracts`, `payments`, `support_subscriptions`
   - `leads_trials`
   - RPC `get_client_pos_sessions`
   - Edge function `validate-pos-login`
3. **Stubs creados** para módulos compartidos aún no migrados:
   - `src/data/licensePlans.ts` — `planLabel(key)`
   - `src/data/posModules.ts` — lista de módulos POS para tickets
   - `src/hooks/useWhatsAppConfig.ts` — `buildUrl(msg)` → `wa.me`
   - `src/components/shared/TrainingVideoHub.tsx` — placeholder
   - `src/components/shared/SupportArticlesHub.tsx` — placeholder
4. **Tablas existentes que sí funcionan ya**: `licenses` (consultas en
   `ClientDashboardTab`, `ClientSubscriptionTab`, `ClientBillingTab`).

### Rutas
- `/clientes` ya muestra el **portal real** (no el placeholder anterior).
- `mi.sistecpos.com/` redirige al mismo portal mediante `TenantHome`.

---

## Fase 3 — Esquema DB Clientes (completada ✅)

### Tablas creadas
| Tabla | Propósito | RLS |
|---|---|---|
| `client_tickets` | Tickets de soporte | Dueño + admin/superadmin |
| `ticket_messages` | Chat por ticket | Dueño del ticket + admin |
| `payments` | Facturas y pagos | Lectura dueño · escritura admin |
| `support_subscriptions` | Planes de soporte | Lectura dueño · escritura admin |
| `contracts` | Contratos firmados (PDF) | Lectura dueño · escritura admin |
| `client_downloads` | Descargas públicas | Lectura pública (activos) · escritura admin |
| `client_pos_sessions` | Sesiones POS remotas | Dueño + admin |
| `leads_trials` | Credenciales prueba POS | Solo admin/superadmin |

### Otros cambios
- `licenses`: añadidas `contact_email`, `business_name`, `plan_type`, `start_date`.
- Storage: bucket privado **`ticket-attachments`** con policies por carpeta `{user_id}/...`.
- Realtime habilitado en `client_tickets` y `ticket_messages` (chat en vivo).
- Triggers `updated_at` y índice único case-insensitive en `leads_trials.email`.

### Pendiente (no incluido en esta fase)
- RPC `get_client_pos_sessions` y edge function `validate-pos-login` (se agregarán
  cuando definamos el contrato real con `softwarepos.online`).
- Los 71 warnings del linter son pre-existentes (no introducidos por esta migración).

---

## Fase 4 — SSO cross-domain (completada ✅)

### Estrategia elegida
**Handoff por URL fragment** en vez de cookies de dominio raíz. Motivo: el
cliente Supabase ya está configurado con `storage: localStorage` (no se puede
tocar `client.ts`), y `localStorage` está aislado por subdominio. Una cookie
`Domain=.sistecpos.com` sería ignorada por el SDK.

### Cómo funciona
1. El usuario hace click en un `<TenantLink tenant="pos">…</TenantLink>` en,
   por ejemplo, `admin.sistecpos.com`.
2. `buildHandoffUrl()` lee la sesión actual y construye:
   `https://pos.sistecpos.com/?sso=1#sps_sso=<base64(access+refresh+iat)>`
3. El navegador navega. El **fragment NUNCA viaja al servidor**, así que el
   token no se loguea en CDN ni en analytics.
4. En el destino, `main.tsx` llama `consumeHandoff()` **antes** de montar React:
   - Verifica TTL (60 s).
   - `supabase.auth.setSession({ access_token, refresh_token })`.
   - Limpia el hash con `history.replaceState`.
5. `AuthContext` arranca ya autenticado, sin parpadeo de login.

### Archivos
- `src/lib/ssoHandoff.ts` — `buildHandoffUrl(tenant, path)`, `consumeHandoff()`, `tenantHost(t)`.
- `src/components/TenantLink.tsx` — `<a>` que salta entre subdominios con SSO.
- `src/main.tsx` — `consumeHandoff()` antes de `createRoot`.

### Limitaciones / siguientes pasos
- TTL del handoff: 60 s. Si el usuario tarda más, se ignora y debe re-loguear.
- No cubre **logout global**: cerrar sesión en `admin.` no cierra `mi.`/`pos.`
  Para eso haría falta una edge function que invalide el refresh token (lo
  podemos añadir cuando sea necesario).
- En dev / preview no hay subdominios reales: `TenantLink` cae a
  `?tenant=<x>` sobre el mismo origen, conservando la sesión nativamente.

---

## Migración completa ✅
Fases 1 → 4 entregadas. El portal de clientes vive en `mi.sistecpos.com`,
con DB propia, RLS por dueño y SSO cross-subdominio funcional.


## Fase 5 — Consolidación Producción (2026-05-25)

### Backend
- Tabla `sync_outbox` (pending/succeeded/dead, backoff exponencial 1/5/30/120/720 min, max 5 intentos).
- Rol `cashier` agregado al enum `app_role`.
- Helper `can_write_org(_org_id)` → superadmin u org member con rol admin/cashier/owner.
- RLS de escritura aplicada a `pos_orders`, `pos_payments`, `cash_sessions`, `cash_movements`.
- Trigger `fill_default_cost_price` en `products` (margen configurable en `app_settings.default_cost_margin`, default 0.35).
- Catálogo `cash_denominations` (COP) + `cash_session_counts` + RPC `close_cash_session_with_counts`.
- Trigger `enqueue_whatsapp_on_confirmed` en `orders` → encola en `sync_outbox` cuando `status` pasa a `confirmed`.

### Edge Functions
- `wp-revalidate-webhook` endurecida con HMAC SHA-256 (`X-Sistecpos-Signature` + `WP_REVALIDATE_SECRET`). Fallback a `revalidate_token` por tenant solo si el secreto no está configurado. En fallo de revalidate, encola reintento en `sync_outbox`.
- `sync-outbox-flush` (nueva): drena pendientes vencidos, dispara por `target` y aplica backoff o marca `dead`.

### Cron
- Job `sync-outbox-flush-2min` (`*/2 * * * *`) llama a `sync-outbox-flush`.

### Secrets
- `WP_REVALIDATE_SECRET` configurado en runtime secrets.

---

## Estado de servicios

| Servicio                      | Estado | Última verificación | Notas                                        |
|-------------------------------|--------|---------------------|----------------------------------------------|
| Sync WP — productos           | activo | 2026-05-25          | Outbox + reintento automático                |
| Sync WP — pedidos             | activo | 2026-05-25          | Outbox + reintento automático                |
| WP Revalidate webhook         | activo | 2026-05-25          | HMAC SHA-256 requerido                       |
| WhatsApp on orders.confirmed  | activo | 2026-05-25          | Trigger DB → outbox → send-ycloud-whatsapp   |
| Email transaccional (Resend)  | activo | 2026-05-25          | pgmq queue + retries                         |
| SSO handoff one-shot          | activo | 2026-05-25          | TTL 60s + cron cleanup cada 5 min            |
| Global logout (auth-global)   | activo | 2026-05-25          | Realtime broadcast `user:<id>`               |
| Cierre de caja (denoms COP)   | activo | 2026-05-25          | RPC close_cash_session_with_counts           |
| cost_price auto-fill          | activo | 2026-05-25          | Trigger BEFORE INSERT/UPDATE en products     |

---

## Fase 6 — Sincronización profesional (resiliencia + auditoría) (2026-05-25)

### a) Esquema `sync_logs`

| Columna           | Tipo         | Notas                                                |
|-------------------|--------------|------------------------------------------------------|
| `id`              | uuid PK      | `gen_random_uuid()`                                  |
| `organization_id` | uuid         | tenant (nullable para jobs globales)                 |
| `service_name`    | text         | `sync-products-to-wp`, `process-email-queue`, etc.   |
| `status`          | text         | `pending` · `success` · `error` · `partial`          |
| `error_message`   | text         | mensaje resumido del último fallo                    |
| `payload`         | jsonb        | parámetros de entrada + métricas de salida           |
| `attempts`        | int          | nº de intentos consumidos (con backoff)              |
| `duration_ms`     | int          | ms totales de la corrida                             |
| `started_at`      | timestamptz  | inicio                                               |
| `last_run_at`     | timestamptz  | último upsert (driver de la UI)                      |
| `created_at`      | timestamptz  | alta                                                 |

Índices: `(organization_id, service_name, last_run_at DESC)` y `(status, last_run_at DESC)`.

RLS: lectura para miembros de la org (o superadmin); escritura **solo** vía RPC `log_sync_event` (SECURITY DEFINER) o service role.

RPC `log_sync_event(_log_id, _organization_id, _service_name, _status, _error_message, _payload, _attempts, _duration_ms) → uuid` — upsert idempotente; si `_log_id` se proporciona y no existe, se inserta con ese id.

### b) Exponential Backoff

Helper compartido `supabase/functions/_shared/syncLogger.ts`:

- `withRetry(fn, { delaysMs, shouldRetry, onRetry })` — política por defecto **1 s → 5 s → 30 s** (3 reintentos, 4 ejecuciones máx).
- `isTransientHttpError(err)` — reintenta solo en errores de red, HTTP 5xx y 429; **NO** reintenta 4xx (validación, auth).
- Cada attempt incrementa `attempts` en `sync_logs`. Si todos los intentos fallan, el item se encola en `sync_outbox` (`status='failed'`, `next_attempt_at = now()+60s`) para que `sync-outbox-flush` lo recoja en su barrido `*/2 min`.

Aplicado en `sync-products-to-wp`:

1. `startSyncLog` al recibir el request (status `pending`).
2. GET por slug del CPT (idempotencia) con `withRetry`.
3. POST de upsert (`/wp/v2/{cpt}` o `/wp/v2/{cpt}/{id}`) con `withRetry`.
4. `finishSyncLog` con `success` / `partial` / `error` + duración + métricas.

### c) Credenciales — confirmación

- ✅ Ninguna credencial WP/yCloud/Innapsis se importa, lee o expone desde `src/`.
- ✅ Las edge functions leen únicamente desde `Deno.env.get(...)` (`WP_REVALIDATE_SECRET`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, etc.) y desde `tenant_wp_config` (filtrada por RLS de membresía).
- ✅ `wp_app_password` se almacena en `tenant_wp_config` y se compone como Basic Auth **dentro** de la edge function — nunca llega al cliente.
- ✅ El componente `SyncStatusTable` solo consulta `sync_logs` (RLS por org) e invoca funciones vía `supabase.functions.invoke()` con el JWT del usuario.

### d) UI — `SyncStatusTable`

- Ubicación: `src/components/admin/SyncStatusTable.tsx`, montado en `AdminDashboard` como pestaña **"Sincronización"** (`superadmin` + `admin`).
- Suscripción Realtime a `public.sync_logs` (refresca al instante).
- Semáforo: verde `success` · ámbar `partial` · rojo `error` · gris `pending`.
- Botón **"Forzar"** por servicio que invoca la edge function correspondiente; para `sync-products-to-wp` resuelve `site_id` desde `tenant_sites`.

### Estado de servicios — actualización

| Servicio                      | Estado | Auditoría        | Notas                              |
|-------------------------------|--------|------------------|------------------------------------|
| Sync WP — productos           | activo | sync_logs        | Idempotente + backoff 1/5/30 s     |
| Sync outbox flush             | activo | sync_logs        | Cron `*/2 min`                     |
| WP Revalidate webhook         | activo | sync_logs (opt)  | HMAC SHA-256                       |
| Email transaccional           | activo | pgmq + sync_logs | Retries vía cola                   |
| WhatsApp (yCloud)             | activo | sync_logs (opt)  | Trigger DB → outbox                |


---

## [2026-05-26] Estabilización producción — Fases 2/3/4

### Fase 4 · Estabilidad UI
- `src/components/pos/POSErrorBoundary.tsx` — envuelve `POSWorkspace` en `src/pages/POS.tsx`. Pantalla de fallback con botones "Recuperar y continuar" (reload preservando localStorage) y "Reintentar sin recargar".
- `src/components/ui/skeleton-presets.tsx` — presets reutilizables: `TableSkeleton`, `CardGridSkeleton`, `FormSkeleton`, `StatGridSkeleton`.

### Fase 3 · Observabilidad
- `src/components/admin/DeadLetterQueue.tsx` — nuevo componente DLQ. Lee `sync_outbox` con `status='dead'`, suscripción Realtime, acciones por fila: **Reintentar** (vía edge function), **Ver payload**, **Descartar**.
- Edge function `sync-outbox-retry` — reset atómico de una fila (`status='pending'`, `attempts=0`, `next_attempt_at=now()`, `last_error=null`). Requiere JWT válido.
- `AdminDashboard` → pestaña **Sincronización** ahora renderiza `SyncStatusTable` + `DeadLetterQueue` apiladas.
- Migración: índice `idx_sync_outbox_status_next_attempt ON sync_outbox(status, next_attempt_at) WHERE status IN ('pending','dead')`.

### Fase 2 · Resiliencia
- `sync-outbox-flush`: añadido **jitter ±20 %** al backoff exponencial para evitar thundering herd en reintentos paralelos. Backoff cross-job actual: 1, 5, 30, 120, 720 min (× jitter).

### Pendientes (próximo turno)
- **Fase 1** — auditoría RLS (85 warnings pre-existentes del linter, principalmente `SECURITY DEFINER` funciones públicas y `RLS_ENABLED_NO_POLICY`). Requiere revisión cuidadosa caso por caso.
- **Fase 0** — reestructura `/` → `LoginRouter` con rutas `/admin/login` y `/user/login`, Surteya bajo `/surteya/*` o subdominio. Bloqueado en preguntas abiertas (ver `.lovable/plan.md`).
- **Fase 5** — actualización completa de `docs/views-map.md`.

## [2026-05-27] Fase 1 · Auditoría RLS / SECURITY DEFINER

### Lockdown granular de funciones
- Migración: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` sobre las 41 funciones `SECURITY DEFINER` en `public.*`, seguido de `GRANT EXECUTE` granular por audiencia.
- **anon + authenticated** (storefront público / POS desktop sin sesión): `resolve_tenant_by_host`, `get_landing_by_slug`, `validate_coupon`, `get/upsert/complete_persistent_cart`, `register_activation`, `heartbeat_activation`.
- **authenticated**: helpers RBAC (`has_role`, `has_any_role`, `is_member_of`, `org_role`, `has_module`, `can_access_section`, `can_write_org`, `user_orgs`, `default_org_id`, `get_current_user_role`, `is_master_superadmin`), POS/inventario (`apply_stock_movement`, `receive_purchase_order`, `apply_invoice_scan`, `rematch_invoice_scan`, `apply_catalog_template`, `close_cash_session_with_counts`), cupones (`redeem_coupon`), sync (`log_sync_event` ×2, `get_recent_sync_logs`, `log_usage`), agenda (`get_resource_availability`), licencias admin (`create_license`, `revoke_activation`, `count_active_terminals`).
- **service_role only**: `cleanup_sso_tokens`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`.
- **sin GRANT** (triggers internos): `handle_new_user`, `associate_guest_orders`, `auto_create_base_presentation`, `validate_product_media_type`, `update_updated_at_column`, `generate_customer_code`, `fill_default_cost_price`, `enqueue_whatsapp_on_confirmed`, `prevent_master_superadmin_demotion`, `touch_admin_section_access`, `refresh_template_total`.

### sso_handoff_tokens
- Policy `sso_handoff_tokens_no_client_access` (RESTRICTIVE, USING false) para anon + authenticated. Acceso únicamente vía edge functions con `service_role`.

### Resultado linter
- Antes: **85 warnings** (incluyendo `RLS_ENABLED_NO_POLICY` en `sso_handoff_tokens`).
- Después: **44 warnings** residuales, todas intencionales (funciones públicas del storefront + 2 buckets públicos `product-images` / `desktop-releases`). Documentadas en security memory.

## [2026-05-27] Fase 5 · Documentación

- `docs/views-map.md` reescrito de "SURTÉ YA" → **SistecPOS Core**:
  - Nueva sección **0. Entrada al sistema** (subdomain detection, LoginRouter, /admin/login, /user/login, /surteya/* path fallback, SurteyaRedirect).
  - Tab **Sincronización** documentada con `SyncStatusTable` + `DeadLetterQueue` + `sync-outbox-retry`.
  - Sección **D. Operación / POS / ERP** ampliada con sub-componentes del POSWorkspace y mención a POSErrorBoundary.
  - Nueva sección **E. Infraestructura transversal** (todos los providers/listeners de App.tsx, skeleton-presets).
  - Nueva sección **F. Edge Functions activas** (categorizada por dominio, marca `sync-outbox-*` como Fases 2-3).
  - Nueva sección **G. Seguridad postura actual** (resumen Fase 1: grants granulares, sso_handoff_tokens, buckets públicos intencionales).

## Auditoría de estado de fases (cierre 2026-05-27)

| Fase | Estado | Entregables verificados |
|---|---|---|
| 0 · Routing multi-tenant | ✅ | `src/pages/LoginRouter.tsx`, `src/components/SurteyaRedirect.tsx`, rutas `/admin/login`, `/user/login`, `/surteya/*` en `src/App.tsx`, `detectTenant()` en `src/lib/subdomain.ts` |
| 1 · Auditoría RLS / SECURITY DEFINER | ✅ | Lockdown granular (41 funciones), policy denegada en `sso_handoff_tokens`, linter 85 → 44 (residuales intencionales documentadas en security memory) |
| 2 · Resiliencia sync | ✅ | Jitter ±20 % en backoff exponencial de `sync-outbox-flush` |
| 3 · Observabilidad (DLQ) | ✅ | `DeadLetterQueue.tsx` con Realtime, `sync-outbox-retry` edge function, índice `idx_sync_outbox_status_next_attempt` |
| 4 · Estabilidad UI | ✅ | `POSErrorBoundary.tsx` envolviendo POSWorkspace, `skeleton-presets.tsx` (TableSkeleton / CardGridSkeleton / FormSkeleton / StatGridSkeleton) |
| 5 · Documentación | ✅ | `docs/views-map.md`, `MIGRATION_LOG.md` y `security memory` actualizados |

**Pendientes técnicos opcionales** (no bloqueantes):
- Configurar DNS de `surteya.sistecpos.com` y otros subdominios de tenant.
- Verificar dominio `notify.sistecpos.com` en panel de Cloud → Emails.
- Cron en `sync-outbox-flush` (actualmente disparado on-demand / via Realtime).
