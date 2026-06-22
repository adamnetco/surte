# POS-Eliminar-vinculacion-dominios

**Estado:** SHIPPED (2026-06-22 — gaps de review 2026-06-17 resueltos, edge function + UI + E2E en producción)
**Módulo:** superadmin (Sitios Web) + platform (scope)
**Owner:** Eduardo Tobacia
**Creado:** 2026-06-17

---

## 1. Problema

En la zona **Superadmin → Sitios Web** (`/sitios` → tabs `Sitios`, `Dominios`, `Cloudflare`) hay dos defectos detectados:

1. **Cross-tenant leak por dominio mal vinculado.** El tenant **`surteya`** tiene dos dominios cargados en `tenant_domains`; uno de ellos terminó "creando"/sirviendo al tenant **Freshlove Heladería**, que es una organización distinta. Hoy no existe una acción segura para **desvincular / eliminar** ese dominio desde la UI con confirmación, auditoría y limpieza de caché de resolución (`resolve_tenant_by_host` + `useTenantSite`).
2. **Scope ambiguo en gestión de Sitios.** Las tabs de `Sitios.tsx` leen `orgId` desde el contexto, pero la UI no muestra claramente **a qué tenant pertenece cada acción** (crear sitio, agregar dominio, marcar primario, WP config). Cuando el superadmin cambia de scope con `TenantSwitcher`, los listados pueden mostrar datos del scope anterior por caché de React Query no invalidada.

Riesgo: un superadmin puede creer que está operando sobre Tenant A y aplicar cambios sobre Tenant B (igual al bug que originó Freshlove sobre surteya).

## 2. Objetivo

- Permitir **eliminar un dominio** (`tenant_domains`) y **desvincular** completamente de Cloudflare + cache, con confirmación fuerte y registro en `tenant_audit_log`.
- Garantizar que **toda la página `/sitios` esté siempre vinculada al scope activo** (`OrganizationContext`), con banner visible del tenant en foco e invalidación automática de queries al cambiar de scope.
- Soporte avanzado: ver dueño real del dominio (`organization_id` + `tenant_sites.name`), detectar dominios huérfanos (`site_id` apunta a sitio de otra org) y ofrecer acción de **mover** o **borrar**.

## 3. No-Goals

- No rediseñar `DomainWizard` ni el flujo Cloudflare API (solo agregar `purge` y `delete`).
- No tocar `astro-starter` ni el resolver edge.
- No reescribir `TenantSwitcher`.

## 4. Decisiones

1. **Hard delete** de `tenant_domains` (no soft delete): el dominio es identificador único; soft delete confundiría el resolver. Auditar antes de borrar.
2. La acción **Eliminar dominio** ejecuta en orden:
   a. `verify_tenant_domain` (snapshot estado).
   b. Edge function `delete-tenant-domain` → llama Cloudflare API (`DELETE custom_hostnames/{id}`) si hay `cf_hostname_id`. **Nota:** no se borra `dns_records` porque el DNS lo configura el cliente en su propio proveedor (solo el `custom_hostname` vive en CF de SistecPOS).
   c. `DELETE FROM tenant_domains WHERE id = ?` con RLS de superadmin.
   d. Insert en `tenant_audit_log` con `action='domain.deleted'`, payload `{ hostname, site_id, organization_id, cf_hostname_id, cf_dns_record_id }`.
   e. Invalidate caches: `['tenant-domains', orgId]`, `['tenant-sites', orgId]`, y `queryClient.removeQueries({ queryKey: ['tenant-site'] })` (resolver).
3. **Scope guard**: si `tenant_domains.organization_id !== currentOrg.id`, la fila se muestra con badge `⚠ Foráneo`. El borrado usa el mismo `AlertDialog` con confirmación por tipeo exacto del hostname (el audit log ya registra quién/cuándo/qué, sin justificación adicional).
4. **Banner de scope** persistente en `/sitios` que muestre `Operando sobre: {currentOrg.name} ({currentOrg.slug})` y un botón `Cambiar`.
5. Al cambiar scope (subscribe a `OrganizationContext`), invalidar **todas** las queries con prefijos `tenant-sites`, `tenant-domains`, `cloudflare-*`, `wp-config`.
6. **Fallback Cloudflare**: si `DELETE custom_hostnames` o `DELETE dns_records` retorna error (4xx/5xx) y no es 404, NO borrar la fila de `tenant_domains`. Mostrar error con `cf_error_code` y permitir reintentar. Un 404 de CF se trata como éxito idempotente (recurso ya no existe).

## 5. Criterios de Aceptación

- **AC1** — En `/sitios` tab `Dominios`, cada fila tiene botón `Eliminar` (icono Trash) con `AlertDialog` que pide tipear el hostname exacto para confirmar.
- **AC2** — Al confirmar, se invoca edge function `delete-tenant-domain` que purga Cloudflare + borra fila; toast de éxito con detalle de qué se purgó.
- **AC3** — Inserta registro en `tenant_audit_log` con action `domain.deleted` y payload completo `{ hostname, site_id, organization_id, cf_hostname_id, cf_dns_record_id, actor_id }` (verificable vía query).
- **AC4** — Un dominio se considera **Foráneo** si: (a) `tenant_domains.organization_id !== tenant_sites.organization_id` (caso huérfano Freshlove), o (b) en modo "Ver todos los dominios" (toggle superadmin) cuando `tenant_domains.organization_id !== currentOrg.id`. En ambos casos la fila muestra badge `⚠ Foráneo` y el flujo de borrado es el mismo (confirmación por tipeo); el audit log queda con `actor_id` y `organization_id` para trazabilidad.
- **AC5** — Banner superior fijo en `/sitios` muestra el tenant activo (`name` + `slug`) y se re-renderiza al cambiar de scope.
- **AC6** — Al cambiar de scope con `TenantSwitcher`, las queries con prefijos `tenant-sites`, `tenant-domains`, `cloudflare-*`, `wp-config` quedan invalidadas (sin datos del scope anterior visibles en la siguiente render).
- **AC7** — Si Cloudflare API falla (≠404), la fila de `tenant_domains` permanece y el toast muestra `cf_error_code`. Reintentar la acción completa el borrado cuando CF responde OK. Un 404 de CF se trata como éxito idempotente.
- **AC8** — Smoke E2E `e2e/sitios-delete-domain.spec.ts`: abrir tab Dominios → click Eliminar → tipear hostname → confirmar → verificar fila ausente + entrada en audit log (Cloudflare API mockeada). Happy path con CF real se valida en nightly.

## 6. Tablas DB afectadas

- `tenant_domains` — DELETE (RLS ya existe para superadmin).
- `tenant_audit_log` — INSERT vía trigger o RPC `_tenant_log()`.
- Nuevo edge function: `supabase/functions/delete-tenant-domain/index.ts`.

## 7. Componentes UI afectados

- `src/modules/superadmin/pages/Sitios.tsx` — añadir banner scope, mejorar `remove()` con AlertDialog, badge Foráneo, listener de cambio de scope.
- `src/modules/superadmin/components/SiteDetailsPanel.tsx` — botón eliminar inline en dominios listados.
- (nuevo) `src/modules/superadmin/components/DeleteDomainDialog.tsx` — diálogo reutilizable con confirmación por tipeo.

## 8. Dependencias

- `POS-tenant-lifecycle` (ya SHIPPED) — `tenant_audit_log` + `_tenant_log()` existen.
- `cloudflare-domain-connect` y `provision-tenant-domain` edge functions — referenciar IDs CF al borrar.

## 9. Riesgos

- Si Cloudflare API falla durante delete, dejar `tenant_domains` intacto y mostrar error (no orfandad) — cubierto por AC7.
- Cache del resolver (`useTenantSite`, staleTime 10min): documentar que cambio toma efecto en hasta 10 min para visitantes con sesión activa, o forzar bust con `cf_purge` opcional.

## 10. Plan de implementación

1. Migration: nada nuevo de schema, solo confirmar RLS DELETE en `tenant_domains` para superadmin.
2. Edge function `delete-tenant-domain` (CORS + verify_jwt + role check superadmin + manejo idempotente 404 CF).
3. UI: AlertDialog + banner scope + listener.
4. E2E smoke test con CF mockeado.
5. `/POS-review Eliminar-vinculacion-dominios`.

## 11. Verificación post-deploy (manual)

- **Repro Freshlove**: superadmin entra a scope `surteya`, ve los 2 dominios, identifica el que apunta a `Freshlove`, lo elimina, y verifica que `resolve_tenant_by_host(<hostname>)` retorna null y que `Freshlove Heladería` ya no es accesible por ese hostname.

## 12. Fuera de scope

- Notificación email al owner del tenant afectado cuando se borra un dominio foráneo (puede ser spec aparte si se necesita).
- Script masivo de limpieza de huérfanos: la UI con badge `⚠ Foráneo` permite limpiar uno a uno; solo crear script si aparecen >10 casos.

## 13. Gaps de Review 2026-06-17 (resueltos)

**G1 — AC4 semánticamente roto.** RESUELTO en `Sitios.tsx`:
  - Query incluye `tenant_sites(organization_id, name, slug)`.
  - `isForeign = isOrphan || isOutOfScope` donde `isOrphan = d.tenant_sites.organization_id !== d.organization_id` (caso Freshlove) y `isOutOfScope` aplica en modo "Ver todos".
  - Agregado toggle "Ver todos los dominios (superadmin)" que omite el filtro `eq('organization_id', orgId)`.
  - `DeleteDomainDialog` recibe el `isForeign` correcto en ambos casos.

**G2 — AC2 incompleto (purga dns_records).** RESUELTO ajustando spec §4.2.b: la tabla `tenant_domains` no modela `cf_dns_record_id` porque el DNS del cliente vive en SU proveedor (no en CF de SistecPOS); solo el `custom_hostname` vive en CF. El borrado de `custom_hostname` (con 404 idempotente) es suficiente.

**G3 — actor_email.** RESUELTO: la columna existe en `tenant_audit_log` (migration `20260612171250`) y la usa el insert.

