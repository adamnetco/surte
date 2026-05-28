# Plan: Aislamiento estricto por tienda, auditoría UX del Superadmin, import/export modo isla y tests

Asumo el rol de ingeniero de software responsable del diseño del sistema, infraestructura, lógica de uso y QA. Trabajo en 4 frentes que se entregan en orden.

## 1) Auditoría UX/UI del Superadmin (entrega de hallazgos + fixes)

Reviso `SuperadminDashboard`, `SuperadminSidebar`, `TenantSwitcher`, `TenantHealth`, `RequireActiveTenant`, `OrganizationContext` y rutas en `App.tsx`. Foco:

- **Ámbito siempre visible**: el switcher debe quedar fijo arriba del sidebar y resaltar visualmente cuando estoy en una vista "por tienda" vs "global".
- **Separación clara Global ↔ Tienda** en el sidebar (dos secciones con encabezado, no items mezclados).
- **Estado vacío inteligente**: si no hay tienda activa y entro a una ruta por-tienda, mostrar un *Empty State* con CTA "Elegir tienda" (hoy `RequireActiveTenant` redirige sin contexto).
- **Breadcrumb** que muestre `Superadmin / {Tienda} / {Sección}` con la tienda como chip clickeable que abre el switcher.
- **Health Dashboard**: agrupar KPIs en 3 tarjetas (Configuración, Operación 24h, Sincronización) con score y acciones rápidas por fila ("Configurar módulos", "Subir certificado DIAN", "Ver cola de sync").
- **Listado de tiendas**: añadir columna "Health" (badge color), última venta, estado de sync; acciones rápidas (entrar al admin de la tienda, abrir health, abrir módulos).
- **Mobile**: el switcher ya está en el header móvil; mejorar `TenantSwitcher compact` para que muestre el nombre activo truncado y un indicador de scope.

Entrego un documento corto `docs/ux-audit-superadmin.md` con hallazgos + decisiones, y aplico los fixes listados.

## 2) Aislamiento por tienda — modo isla

Refuerzo el aislamiento que ya existe (RLS por `organization_id`) en la capa de UI y datos:

- **Contexto activo por tienda**: en cualquier vista `/superadmin/t/:slug/*`, `OrganizationContext.currentOrg` se fuerza al slug de la URL (no al de localStorage). Hoy el slug de la URL y el `currentOrgId` pueden desincronizarse. Creo un hook `useTenantFromRoute()` que sincroniza ambos y muestra un banner si difieren.
- **Guard de queries**: añado un helper `scopedFrom(table)` que envuelve `supabase.from(table).eq("organization_id", currentOrg.id)` y se usa en componentes Superadmin (al menos en los nuevos: import/export, health).
- **Realtime aislado**: cualquier `channel` en superadmin filtra por `organization_id=eq.{id}`.

## 3) Import / Export modo isla por tienda

Hoy `DataManagementTab` es global. Creo una versión por-tienda:

- Nueva ruta `/superadmin/t/:slug/datos` con `TenantDataIsland.tsx`.
- **Export**: descarga ZIP con CSVs (`products.csv`, `categories.csv`, `customers.csv`, `orders.csv`, `presentations.csv`, `stock.csv`) filtrados estrictamente por `organization_id`. Nombre del archivo: `{slug}-{YYYYMMDD}.zip`.
- **Import**: sube ZIP o CSVs sueltos; usa `dataImportUtils` (ya existe y tiene tests) y fuerza `organization_id = currentOrg.id` en cada fila antes del insert (ignora cualquier `organization_id` del CSV → previene contaminación cruzada).
- **Validación previa**: muestra resumen (filas a crear / actualizar / con error) antes de aplicar, con confirmación `window.confirm`.
- Quito el `DataManagementTab` global del sidebar Superadmin (o lo dejo como "Importar catálogo base", que es distinto).

## 4) Tests unitarios + smoke E2E del Superadmin

- **Unit (vitest)**, archivos nuevos junto a la fuente:
  - `src/lib/tenantScope.test.ts`: helper `scopedFrom` y `useTenantFromRoute`.
  - `src/components/superadmin/TenantSwitcher.test.tsx`: render, cambio de tienda, persistencia.
  - `src/components/superadmin/RequireActiveTenant.test.tsx`: empty state vs render hijo.
  - `src/lib/tenantDataIsland.test.ts`: builder ZIP, normalización de filas en import (forzar org_id).
- **Smoke E2E (playwright)** en `e2e/superadmin.spec.ts` cubriendo el flujo: login → dashboard → crear tienda (wizard) → switcher → health → módulos → export CSV → logout. Uso el fixture ya existente.

## Detalles técnicos

- Nuevos archivos:
  - `src/hooks/useTenantFromRoute.ts`
  - `src/lib/tenantScope.ts` (`scopedFrom`)
  - `src/lib/tenantDataIsland.ts` (export/import por org)
  - `src/components/superadmin/TenantDataIsland.tsx`
  - `src/components/superadmin/TenantHealthCards.tsx` (refactor visual)
  - `docs/ux-audit-superadmin.md`
  - Tests indicados arriba.
- Modificados: `SuperadminSidebar`, `SuperadminDashboard` (nueva ruta `t/:slug/datos`), `OrganizationContext` (sync con URL), `RequireActiveTenant` (empty state), `TenantHealth` (usar nuevas tarjetas).
- Dependencias: uso `jszip` (ya está en `package.json` si está; si no, lo agrego).
- No toco RLS — el aislamiento ya está en DB; refuerzo en UI/data layer.

## Entrega por iteraciones

1. **Iteración A**: Auditoría UX + fixes de sidebar/switcher/empty state/breadcrumb + sync URL↔contexto.
2. **Iteración B**: Import/Export modo isla por tienda.
3. **Iteración C**: Tests unitarios + smoke Playwright del Superadmin.

¿Apruebas el plan así o ajusto alcance (por ejemplo, dejar E2E para una segunda fase, o priorizar import/export antes que la auditoría UX)?
