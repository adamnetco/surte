---
name: SaaS Refactor Etapa 14
description: Tenant scoping for Inventario, SyncMonitor/StatusTable, KDS, Mesas, POS + audit regex refinado
type: feature
---

# Etapa 14 — Cierre de admin POS + Sync + audit v4

## Hallazgos previos vs. real
- **Inventario.tsx**, **KDS.tsx**, **Mesas.tsx**, **POS.tsx**: ya estaban scoped por `currentOrg.id`.
- **pushClient.ts**: `push_subscriptions` es per-user (RLS por `user_id`), no multi-tenant. Sin cambios.

## Cambios aplicados
- **SyncStatusTable.tsx**: ahora consume `useOrganization()` y filtra `tenant_sites` por `organization_id` al lanzar `sync-products-to-wp`.
- **KDS.tsx**: `kds_tickets.update(...)` añade `.eq("organization_id", orgId)` (defense-in-depth).
- **Mesas.tsx**: `dining_tables.update({status:"occupied"})` añade `.eq("organization_id", orgId)`.

## Audit regex (scripts/audit-tenant-scope.ts)
Se añadió "look-back" de 600 chars antes del `.from()` para detectar `organization_id` ya asignado en el mismo scope (cubre map inserts batch, payloads ya enriquecidos). Reduce falsos positivos.

## Estado audit v4
- 424 archivos · 33 hallazgos (high: 23, medium: 6, low: 4).
- Top offenders restantes: `supabase/functions/sitemap/index.ts` (selects sin org en branches específicos), `superadmin/CatalogosBase` (legítimo: superadmin = sin tenant), `LandingPagesTab` (mapped insert que el regex aún no resuelve), `storefront/*` (componentes que reciben `orgId` desde el padre vía prop, no detectados por look-back porque el `.from` está fuera del scope literal).

## Pendiente Etapa 15
1. Refactor `sitemap/index.ts`: agregar `.eq("organization_id", tenantOrgId)` también en branches de productos/categorías/brands cuando `tenantOrgId` esté presente.
2. Storefront components que reciben `orgId` por prop: cambiar regex para detectar prop `orgId` o usar `scopedFrom(orgId)`.
3. CatalogosBase: documentar como excepción permitida (superadmin scope global).
