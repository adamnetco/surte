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

## Fase 4 — SSO cross-domain (pendiente)

- Edge function `auth-bridge` → cookie `sb-session; Domain=.sistecpos.com`.
- Adaptador en `AuthContext` que la lea al boot.
