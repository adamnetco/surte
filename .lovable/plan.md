## Alcance y riesgos (léeme antes de aprobar)

El módulo "Clientes" en `sistecpos-colombia` no es una sola página: son **11 componentes** (`ClientPortal`, `ClientDashboardTab`, `ClientBillingTab`, `ClientContractsTab`, `ClientDownloadsTab`, `ClientPOSAccess`, `ClientPOSLogin`, `ClientSubscriptionTab`, `ClientTicketsTab`, `ClientTrainingsTab`, `TicketChatView`) + hooks (`useAuth`, `useActivityTracker`, `useWhatsAppConfig`) + dependencias de tablas Supabase que **no existen** en `sistecposcore` (tickets, contratos, descargas, entrenamientos, facturación de clientes, demos POS, suscripciones).

Hacer todo en un turno es inviable y rompería el build. Propongo dividir en fases entregables.

### Decisiones que necesito confirmar

1. **Backend de los datos de Clientes**: ¿los dos proyectos deben **compartir la misma base de datos Supabase** (la de `sistecpos-colombia`), o quieres que `sistecposcore` tenga **sus propias tablas** y replicar el esquema con migraciones nuevas? Esto define si es un copy/paste o una réplica completa.
2. **Subdominios `mi.` / `pos.` / `app.`**: hoy solo está configurado `admin.sistecpos.com`. ¿Ya tienes los DNS apuntando los otros tres, o los configuras tú en Lovable después?
3. **SSO cross-subdomain**: Supabase guarda la sesión en `localStorage` por defecto (NO se comparte entre subdominios). Para sesión real compartida hay que migrar a **cookies con `Domain=.sistecpos.com`**, lo cual requiere un endpoint propio o un edge function de auth-bridge. ¿Aceptas ese cambio o prefieres que cada subdominio mantenga su propio login (UX similar pero login independiente)?

## Plan en fases

### Fase 1 — Subdomain Router + estructura (este turno)
- Crear `src/lib/subdomain.ts` con `detectTenant()` que lea `window.location.hostname` y devuelva `'admin' | 'mi' | 'pos' | 'app' | 'www'`.
- Envolver `App.tsx` con un selector que monte rutas distintas por tenant:
  - `admin.*` → rutas actuales `/admin/*` + `AdminDashboard`.
  - `pos.*` → `POSWorkspace` como raíz.
  - `app.*` → dashboard general (homepage actual).
  - `mi.*` → placeholder `<ClientPortalShell />` con tabs vacíos (esqueleto listo para Fase 2).
- Login centralizado: rutas `/user/login` y `/admin/login` apuntando al mismo componente `Login` existente, con `redirect` post-auth según tenant.
- Crear `MIGRATION_LOG.md` con sección "Fase 1" registrando archivos creados/modificados.

### Fase 2 — Migración UI Clientes (turno aparte, tras tu OK)
- Copiar los 11 componentes `clientes/*` con `cross_project--copy_project_asset`.
- Adaptar imports (`@/hooks/useAuth` → nuestro `@/context/AuthContext`).
- Stub temporal de tablas inexistentes (devolver arrays vacíos) hasta Fase 3.
- Build verde sin datos reales.

### Fase 3 — Esquema DB Clientes (turno aparte)
- Migración con tablas: `client_tickets`, `client_contracts`, `client_downloads`, `client_trainings`, `client_subscriptions`, `client_billing`, `pos_demos`. RLS por `auth.uid()`.
- Conectar componentes a tablas reales.

### Fase 4 — SSO cross-domain (turno aparte, si confirmas decisión 3)
- Edge function `auth-bridge` que emita cookie `sb-session` con `Domain=.sistecpos.com; Secure; SameSite=Lax`.
- Adaptador en `AuthContext` que lea esa cookie al boot.

## Detalle técnico Fase 1

```text
src/
├── lib/
│   └── subdomain.ts          # detectTenant(): 'admin'|'mi'|'pos'|'app'|'www'
├── routes/
│   ├── AdminRoutes.tsx       # extrae rutas /admin/* actuales
│   ├── PosRoutes.tsx         # ruta única → POSWorkspace
│   ├── MiRoutes.tsx          # /clientes → ClientPortalShell (placeholder)
│   └── AppRoutes.tsx         # rutas públicas actuales (Index, Catálogo, etc.)
├── components/
│   └── clientes/
│       └── ClientPortalShell.tsx   # placeholder con tabs vacíos
└── App.tsx                   # switch por tenant
```

Reglas:
- En dev (`localhost`, `*.lovable.app` de preview) → tenant = `app` por defecto, con `?tenant=mi` para forzar override y poder probar.
- No tocar `src/integrations/supabase/client.ts`.
- No borrar nada del repo `sistecpos-colombia`; solo copia.

## Lo que NO haré sin tu aprobación
- No tocaré DB (Fase 3).
- No cambiaré el almacenamiento de sesión a cookies (Fase 4).
- No eliminaré `sistecpos.com/clientes` (eso lo haces tú quitándolo del repo `sistecpos-colombia` después de Fase 3).

## Respuesta esperada
Responde con:
- Decisión 1 (DB compartida o réplica)
- Decisión 2 (DNS listos sí/no)
- Decisión 3 (SSO real con cookie o login por subdominio)
- ¿Arranco Fase 1?
