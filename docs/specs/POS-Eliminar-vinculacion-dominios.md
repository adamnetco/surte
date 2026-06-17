# POS-Eliminar-vinculacion-dominios

**Estado:** IN_SPEC
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
   b. Edge function `delete-tenant-domain` → llama Cloudflare API (`DELETE custom_hostnames/{id}` + `DELETE dns_records/{id}`) si existen IDs.
   c. `DELETE FROM tenant_domains WHERE id = ?` con RLS de superadmin.
   d. Insert en `tenant_audit_log` con `action='domain.deleted'`, payload `{ hostname, site_id, organization_id, cf_hostname_id, cf_dns_record_id }`.
   e. Invalidate caches: `['tenant-domains', orgId]`, `['tenant-sites', orgId]`, y `queryClient.removeQueries({ queryKey: ['tenant-site'] })` (resolver).
3. **Scope guard**: si `tenant_domains.organization_id !== currentOrg.id`, la fila se muestra con badge `⚠ Foráneo` y solo el superadmin con confirmación doble puede borrarla.
4. **Banner de scope** persistente en `/sitios` que muestre `Operando sobre: {currentOrg.name} ({currentOrg.slug})` y un botón `Cambiar`.
5. Al cambiar scope (subscribe a `OrganizationContext`), invalidar **todas** las queries con prefijos `tenant-sites`, `tenant-domains`, `cloudflare-*`, `wp-config`.

## 5. Criterios de Aceptación

- **AC1** — En `/sitios` tab `Dominios`, cada fila tiene botón `Eliminar` (icono Trash) con `AlertDialog` que pide tipear el hostname para confirmar.
- **AC2** — Al confirmar, se invoca edge function `delete-tenant-domain` que purga Cloudflare + borra fila; toast de éxito con detalle de qué se purgó.
- **AC3** — Inserta registro en `tenant_audit_log` con action `domain.deleted` y payload completo (verificable vía query).
- **AC4** — Si el dominio tiene `organization_id` distinto al scope activo, aparece badge `Foráneo` y el botón Eliminar pide confirmación doble + justificación de texto libre (mín. 10 chars), persistida en audit log.
- **AC5** — Banner superior fijo en `/sitios` muestra el tenant activo y desaparece al cambiar de scope (re-renderiza con el nuevo).
- **AC6** — Al cambiar de scope con `TenantSwitcher`, todas las queries de la página se invalidan en <500ms (sin datos del scope anterior visibles).
- **AC7** — Bug específico reproducible: superadmin entra a scope `surteya`, ve los 2 dominios, identifica el que apunta a `Freshlove`, lo elimina, y el tenant `Freshlove Heladería` ya no resuelve por ese hostname (verificar `resolve_tenant_by_host` retorna null).
- **AC8** — Test E2E `e2e/sitios-delete-domain.spec.ts` cubre: listar dominios → eliminar con confirmación → verificar ausencia en lista + entrada en audit log (mockeable).

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

- Si Cloudflare API falla durante delete, dejar `tenant_domains` intacto y mostrar error (no orfandad).
- Cache del resolver (`useTenantSite`, staleTime 10min): documentar que cambio toma efecto en hasta 10 min para visitantes con sesión activa, o forzar bust con `cf_purge` opcional.

## 10. Plan de implementación

1. Migration: nada nuevo de schema, solo confirmar RLS DELETE en `tenant_domains` para superadmin.
2. Edge function `delete-tenant-domain` (CORS + verify_jwt + role check superadmin).
3. UI: AlertDialog + banner scope + listener.
4. E2E test.
5. `/POS-review Eliminar-vinculacion-dominios`.

---

## Preguntas abiertas

- ¿El dominio "huérfano" de surteya → Freshlove se eliminará **solo desde UI** o también se requiere script de limpieza por DB? (propuesta: UI primero, script solo si hay >3 casos).
- ¿La justificación de borrado de dominio foráneo debe notificarse por email al owner del tenant afectado? (sugerencia: sí, vía `mailService` con template `domain_removed_by_superadmin`).
