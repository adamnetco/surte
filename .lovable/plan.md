
# Plan: Estabilización Final + Admin Panel SistecPOS

## Parte A — Pendientes de infraestructura (Fases 0-5)

1. **DNS / Dominios**
   - Verificar `surteya.sistecpos.com` apuntando a `185.158.133.1` (A record) + TXT `_lovable`.
   - Confirmar `admin.sistecpos.com` ya activo (lista en project_urls).
   - Validar `notify.sistecpos.com` (email infra): correr `email_domain--check_email_domain_status` y reportar DKIM/SPF.

2. **Cron de resiliencia**
   - Activar `pg_cron` job que invoque `sync-outbox-flush` cada 2 min y `sync-outbox-retry` cada 10 min.
   - Migración: `cron.schedule(...)` apuntando a edge functions vía `net.http_post` con `service_role`.

3. **Cleanup SSO**
   - Cron diario: `SELECT public.cleanup_sso_tokens();`

## Parte B — Routing canónico (refinamiento Fase 0)

Estado actual: `/` ya muestra `LoginRouter` en dominios sistema y storefront en subdominios tenant. `/surteya/*` ya enrutado.

Refinamientos:
- **`/` (sistecpos.com raíz)** → SIEMPRE `LoginRouter` (login unificado con detección de rol post-auth).
- **`/surteya`** → tienda semilla path-based (fallback si no usan subdominio).
- **`surteya.sistecpos.com`** → mismo storefront, canonical preferido (301 desde `/surteya` cuando subdominio activo).
- **`admin.sistecpos.com`** → fuerza `LoginRouter` con `intent=admin` y redirige post-login a `/admin`.
- **`pos.sistecpos.com`** → fuerza `LoginRouter` con `intent=pos` y redirige a `/pos`.

Cambios concretos:
- Añadir query param `?intent=admin|pos|cliente` al `LoginRouter` para preseleccionar destino.
- Añadir `<link rel="canonical">` en storefront cuando se accede por `/surteya/*` apuntando a `surteya.sistecpos.com` (ya parcialmente hecho en `SurteyaRedirect`).
- Actualizar `Login.tsx` para honrar `intent` y redirigir según rol detectado (`superadmin/admin` → `/admin`, `cashier` → `/pos`, `user` → `/clientes`).

## Parte C — Admin Panel (admin.sistecpos.com)

Auditoría de pantallas existentes vs. requeridas:

| Pantalla | Estado actual | Acción |
|---|---|---|
| Dashboard Overview | `AdminDashboard.tsx` con DLQ + métricas básicas | Ampliar: ventas totales multi-org, sync status global, licencias activas |
| Gestión Organizaciones | Existe parcial | Crear `/admin/organizations` con alta + toggle de módulos (`organization_modules`) |
| Inventario Maestro | Existe en `/admin/products` | Validar y enlazar a catálogos base (`catalog_templates`) |
| CRM Contactos | Parcial | Crear `/admin/contacts` unificado clientes+proveedores con historial de orders/POs |
| Configuración Fiscal | Falta | Crear `/admin/fiscal` (impuestos, invoice schemes, print layouts) |
| Monitoreo Sync | `DeadLetterQueue` listo | Crear `/admin/sync-monitor` con tabla `sync_logs` + filtros por servicio |

Componentes nuevos a crear:
- `src/pages/admin/OrganizationsManager.tsx`
- `src/pages/admin/ContactsCRM.tsx`
- `src/pages/admin/FiscalSettings.tsx`
- `src/pages/admin/SyncMonitor.tsx`
- Widgets de overview: `SalesGlobalWidget`, `SyncHealthWidget`, `LicenseStatusWidget` en `AdminDashboard`.

## Parte D — Entrega por fases (ejecución incremental)

**Sprint 1 (esta iteración):**
- Refinar `LoginRouter` con `intent` param.
- Crear `/admin/sync-monitor` (alto valor inmediato, usa data existente).
- Crear widgets de overview en Dashboard.
- Verificar dominios (check_email_domain_status).

**Sprint 2:**
- `OrganizationsManager` + módulos toggle.
- `ContactsCRM` unificado.

**Sprint 3:**
- `FiscalSettings` (impuestos + invoice schemes).
- Cron jobs pg_cron + cleanup SSO.

## Detalles técnicos

- Todas las nuevas pantallas usan `max-w-7xl mx-auto`, skeleton presets, `POSErrorBoundary` analógico (crear `AdminErrorBoundary`).
- RLS: nuevas consultas multi-org usan `is_master_superadmin()` + `is_member_of()`.
- Tabla `sync_logs` ya existe → solo UI.
- Realtime en `sync_logs` para Monitor en vivo.
- Toasts top-center, `window.confirm` para acciones destructivas (memoria).

## Confirmación

¿Apruebas el plan y arranco con **Sprint 1** (LoginRouter `intent` + Sync Monitor + Dashboard widgets + verificación de dominios)?
