---
name: SaaS Refactor — Etapa 10
description: admin_list_customer_reviews RPC scoped server-side via current_org_id; tenant audit v3 refined (POS/sitemap/Compras/Fiscal pending).
type: feature
---

# Etapa 10 — Hardening RPC + auditoría v3

## RPC
- `admin_list_customer_reviews()` ahora filtra por `current_org_id()` server-side y lanza `no_active_organization` si no hay membresía. `CustomerReviewsTab` deja de filtrar en cliente.

## Auditoría refinada
- `scripts/audit-tenant-scope.ts`: removidas `app_settings` y `municipality_settings` de `GLOBAL_TABLES` (ahora son multi-tenant). Añadido `crm_leads` como global.
- Resultado: `docs/audit/tenant-scope-2026-06-11-v3.md` — **69 hallazgos (58 high)**.

## Top ofensores pendientes
1. `src/modules/pos/components/TableOrderDrawer.tsx` (table_order_items)
2. `supabase/functions/sitemap/index.ts` (consulta de seo_content / extras)
3. `src/modules/admin-cms/pages/Compras.tsx` (purchase_orders/items, supplier_products)
4. `src/modules/pos/components/CloseSessionDialog.tsx` (cash_sessions/movements/counts)
5. `supabase/functions/invoice-ocr/index.ts` (invoice_scans/items)
6. `FiscalSettingsTab`, `ProductsTab`, `ShippingTab`, `AdminDashboard`, `outbox.ts`, `ProductoDetalle`
7. `GerenteIA.tsx`, `organization-welcome.tsx`, `CatalogosBase.tsx`, `LandingPagesTab.tsx`

Próxima etapa: barrer Top 6 (POS table orders + Compras + cash sessions + invoice OCR).
