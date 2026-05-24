# MIGRATION LOG — sistecpos-colombia → sistecposcore

Registro de migración del módulo **Clientes** y de la arquitectura **multi-dominio**
hacia `sistecposcore`.

---

## Fase 1 — Subdomain Router + esqueleto (en curso)

### Archivos creados

| Archivo | Propósito |
|---|---|
| `src/lib/subdomain.ts` | `detectTenant()` lee `window.location.hostname` y devuelve `'admin' \| 'mi' \| 'pos' \| 'app' \| 'www'`. Soporta override en dev vía `?tenant=`. |
| `src/components/clientes/ClientPortalShell.tsx` | Placeholder del Portal de Clientes con tabs (Resumen, Suscripción, Facturación, Contratos, Descargas, Entrenamientos, Soporte). Listo para rellenarse en Fase 2. |
| `MIGRATION_LOG.md` | Este archivo. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/App.tsx` | Añadidas rutas `/clientes` (ClientPortalShell), `/user/login` y `/admin/login` (ambas apuntan al `Login` existente). La ruta raíz `/` ahora resuelve por tenant: `pos`→POS, `mi`→Portal de Clientes, `admin`→AdminDashboard, `app`/`www`→Index. |

### Rutas añadidas

- `GET /clientes` → `<ClientPortalShell />` (requiere sesión; redirige a `/user/login`).
- `GET /user/login` → `<Login />` (login unificado para clientes).
- `GET /admin/login` → `<Login />` (login unificado para staff).

### Mapeo subdominio → vista raíz

| Host | Tenant | Componente en `/` |
|---|---|---|
| `admin.sistecpos.com` | `admin` | `AdminDashboard` (protegido por `RoleGuard`) |
| `mi.sistecpos.com` | `mi` | `ClientPortalShell` |
| `pos.sistecpos.com` | `pos` | `POSWorkspace` (vía `/pages/POS`) |
| `app.sistecpos.com` | `app` | `Index` (homepage actual) |
| `sistecpos.com` / `www` | `www` | `Index` |
| `localhost` / `*.lovable.app` | `app` (dev) | `Index` — override con `?tenant=mi` |

### Ajustes en AuthContext

**Sin cambios en Fase 1.** El SSO cross-subdomain (cookie con `Domain=.sistecpos.com`)
queda planificado para **Fase 4** porque requiere un edge function `auth-bridge` y
cambio del storage de Supabase Auth. En Fase 1 cada subdominio mantiene su sesión
en `localStorage` (login independiente, misma UI).

---

## Fase 2 — Migración UI Clientes (pendiente)

Componentes a copiar desde `sistecpos-colombia/src/components/clientes/`:

- [ ] `ClientPortal.tsx`
- [ ] `ClientDashboardTab.tsx`
- [ ] `ClientBillingTab.tsx`
- [ ] `ClientContractsTab.tsx`
- [ ] `ClientDownloadsTab.tsx`
- [ ] `ClientPOSAccess.tsx`
- [ ] `ClientPOSLogin.tsx`
- [ ] `ClientSubscriptionTab.tsx`
- [ ] `ClientTicketsTab.tsx`
- [ ] `ClientTrainingsTab.tsx`
- [ ] `TicketChatView.tsx`

Adaptación necesaria: reemplazar `@/hooks/useAuth` → `@/context/AuthContext`.

---

## Fase 3 — Esquema DB Clientes (pendiente)

Tablas a crear con RLS por `auth.uid()`:
`client_tickets`, `client_contracts`, `client_downloads`, `client_trainings`,
`client_subscriptions`, `client_billing`, `pos_demos`.

---

## Fase 4 — SSO cross-domain (pendiente)

- Edge function `auth-bridge` → cookie `sb-session; Domain=.sistecpos.com; Secure; SameSite=Lax`.
- Adaptador en `AuthContext` que la lea al boot.
