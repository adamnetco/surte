# UX Audit — Panel Superadmin (SistecPOS)

> Auditoría realizada como Senior Product Designer + Frontend Engineer.
> Foco: claridad de ámbito (Global vs Tienda), aislamiento por tienda y eficiencia de tareas.

## Hallazgos y decisiones

### 1. Ámbito de gestión confuso (RESUELTO en iteraciones previas)
**Síntoma**: en cada pantalla había que re-elegir tienda.
**Decisión**: switcher persistente en sidebar + breadcrumb con scope chip (`Global` / `Tienda`) + rutas explícitas `/superadmin/t/:slug/...`.

### 2. Configuración mezclada con monitoreo (RESUELTO)
**Síntoma**: "Sincronización" y "Ajustes" vivían a nivel global pero eran por tienda.
**Decisión**: ambas se movieron a `/superadmin/t/:slug/sync` y `/superadmin/t/:slug/fiscal`. Las rutas viejas redirigen al selector de tiendas.

### 3. Datos compartidos entre tiendas (RESUELTO en esta iteración)
**Síntoma**: `DataManagementTab` operaba sin filtro por organización → riesgo de mezclar productos/categorías/etc. entre tiendas.
**Decisión**:
- Nueva ruta **`/superadmin/t/:slug/datos`** con `TenantDataIsland`.
- Export como **ZIP por tienda** (`{slug}-island-{YYYY-MM-DD}.zip`) con manifest.json + CSVs por tabla, todos filtrados por `organization_id`.
- Import que **siempre fuerza `organization_id`** al de la tienda activa, ignorando cualquier valor del archivo → **imposible** contaminar otra tienda al importar.
- La vista global `/superadmin/datos` queda solo para catálogos base globales (no transacciones).
- Sidebar muestra "Datos (isla)" únicamente dentro del contexto de tienda.

### 4. Health dashboard por tienda (RESUELTO previamente)
**Síntoma**: superadmin no tenía un panorama de qué le falta a cada tienda.
**Decisión**: `TenantHealth` con score de completitud + KPIs 24h + cola de sync, accesible en `/superadmin/t/:slug`.

## Aislamiento por tienda — checklist de garantías

| Capa            | Garantía                                                                     | Implementación |
|-----------------|------------------------------------------------------------------------------|----------------|
| Base de datos   | RLS por `organization_id` en todas las tablas isla                            | `is_member_of(_org_id)` |
| Contexto UI     | `currentOrg` sincronizado con slug de URL en rutas `/t/:slug/*`               | `RequireActiveTenant` |
| Lectura         | Todas las queries de Superadmin filtran `eq("organization_id", orgId)`        | `TenantHealth`, `SyncMonitor`, `TenantDataIsland` |
| Escritura masiva| Import fuerza `organization_id` antes de insert/upsert                        | `forceOrgOnRows()` + test unitario |
| Export          | Solo filas de la tienda activa entran en el ZIP                               | `fetchIslandRows()` |

## Tablas incluidas en "modo isla"

categorías, marcas, productos, presentaciones, media de productos, grupos
modificadores, opciones modificadoras, cupones, bodegas, proveedores, áreas de
mesas, mesas.

Tablas transaccionales (orders, pos_orders, sync_logs, cash_sessions) NO se
incluyen en export/import porque deben mantener integridad referencial y no
suelen migrarse entre tiendas.

## Tests

- `src/lib/tenantDataIsland.test.ts` — `forceOrgOnRows` siempre sobrescribe org_id,
  respeta `skipOnImport`, valida orgId requerido.
- `src/test/dataImportUtils.test.ts` — cobertura existente del parser.
