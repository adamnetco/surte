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
