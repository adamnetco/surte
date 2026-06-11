---
name: SaaS Refactor — Etapa 5 (audit refinado + scopedFrom en CMS)
description: Auditoría tenant-scope v2 más precisa; SELECT de admin-cms migrados a scopedFrom; ranking de archivos pendientes para Etapa 6+.
type: feature
---

# Etapa 5 — Audit refinado + migración de SELECT legacy a `scopedFrom`

## Cambios

### 1. Auditoría v2 (`scripts/audit-tenant-scope.ts`)
- Análisis de cadenas multilínea (no línea-por-línea): un `.from("tbl")...select()...eq()` ahora se evalúa como conjunto.
- Whitelist `GLOBAL_TABLES` (organizations, organization_members, app_settings, saas_plans, modules, tenant_*, auth_*, user_roles, etc.).
- Edge functions con `SUPABASE_SERVICE_ROLE_KEY` se ignoran para inserts (contexto admin legítimo).
- Reglas nuevas:
  - `select() without organization_id filter` (high si no es auth/super).
  - `insert() without organization_id` (high siempre).
  - `update/delete without id nor organization_id filter` (medium).
- Salida: top-15 archivos con peso `high·5 + medium·2 + low·1`, top-15 tablas más expuestas.
- Reducción de hallazgos: **330 → 78** (322 medium falsos positivos eliminados).

### 2. SELECT migrados a `scopedFrom` (9 tabs admin-cms)
Patrón aplicado en todos:
```tsx
const { currentOrg } = useOrganization();
const { data } = useQuery({
  queryKey: ["...", currentOrg?.id],
  enabled: !!currentOrg?.id,
  queryFn: async () => {
    const { data, error } = await scopedFrom("tabla", currentOrg!.id).order("...");
    if (error) throw error;
    return data;
  },
});
```

| Archivo | Tablas migradas |
|---|---|
| BrandsTab | `brands` |
| ContentTab | `banners`, `testimonials`, `gallery` (+ insert testimonials con org_id) |
| ShippingTab | `shipping_zones` |
| LandingPagesTab | `landing_pages` |
| FeaturedSectionsTab | `featured_sections`, `products` |
| HeroSlidesTab | `hero_slides` |
| ScriptsTab | `custom_scripts` |

### 3. Reporte
`docs/audit/tenant-scope-2026-06-11-v2.md`

## Top offenders pendientes (Etapa 6)
1. `src/modules/offline/lib/outbox.ts` — insert sin `organization_id` en pos_order_items, pos_payments, pos_quotes, parked_tickets.
2. `src/modules/pos/components/TableOrderDrawer.tsx` — table_order_items.
3. `supabase/functions/sitemap/index.ts` — needs explicit org filter (multi-tenant sitemap).
4. `src/modules/admin-cms/components/{ProductsTab,Compras,CouponsTab,FiscalSettingsTab,SeoContentTab}.tsx`.
5. `src/modules/pos/components/CloseSessionDialog.tsx` — pos_payments.
6. `src/modules/storefront/pages/{ProductoDetalle,Hub}.tsx` — necesitan resolver `tenantSite.organization_id` desde el host.

## Cómo usar
```bash
bun scripts/audit-tenant-scope.ts > docs/audit/tenant-scope-$(date +%F).md
```

## Próxima etapa
Etapa 6: POS offline (`outbox.ts`) + storefront por host (`resolve_tenant_by_host` → organization_id en queries públicas).
