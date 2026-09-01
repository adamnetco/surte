---
name: Desktop runtime genérico + tenant manifest
description: El .exe/.app de escritorio es único para todos los tenants; la identidad llega en tenant_manifest tras activar licencia
type: feature
---
El cliente de escritorio NO se compila por tenant. Un solo binario genérico:

- Globals: `window.sistecposDesktop` (alias legacy deprecado `surteyaDesktop`).
- Env: `SISTECPOS_SUPA_URL/ANON`, `SISTECPOS_PRINT_AGENT_PORT`, `SISTECPOS_AGENT_STATE_DIR` (fallback a las `SURTEYA_*` legacy).
- Estado agente: `~/.sistecpos-print-agent` (usa el legacy si ya existe).
- Cifrado local con salt `::sistecpos`; se conserva lectura del salt legacy.

**Tenant manifest**: `supabase/functions/_shared/tenantManifest.ts` lo arma desde
`organizations`, `organization_modules`, `app_settings`, `locations`,
`einvoice_configs`, `printers`, con `offline_bootstrap_version` (hash corto).
`organization_id` SIEMPRE se deriva de la licencia, nunca del body.

**Flujo**: `license-activate` devuelve `organization_id` + `tenant_manifest` +
`bootstrap_url`; el heartbeat (30 min) revalida el seat y refresca el manifiesto
vía `desktop-tenant-bootstrap`. Licencia revocada/expirada → wipe de
`license.dat`, `activation.token`, `tenant_manifest.dat` y cierre de la app.

**Aislamiento offline**: IndexedDB por organización
(`sistecpos_offline_<orgId>`), con `setOfflineOrganization()` llamado desde
`OrganizationContext`. Nunca mezclar catálogo/outbox/tickets entre tiendas.

**Releases**: `desktop_releases` es global por plataforma/canal; no hay builds
por tenant.

Doc: `docs/desktop/multitenant-runtime.md`.
