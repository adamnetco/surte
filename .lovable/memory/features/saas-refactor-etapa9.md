---
name: SaaS Refactor — Etapa 9
description: Tenant scoping for remaining specialized admin tabs (Contacts, GoogleReviews, Municipalities, Overview, SeoContent, Seo).
type: feature
---

# Etapa 9 — Admin Tabs especializados

Tabs refactorizados para usar `currentOrg.id` y filtrar/inyectar `organization_id`:

- **ContactsTab**: queries de `profiles`, `suppliers`, `orders`, `purchase_orders` ahora filtran por `organization_id`. Guard de UI si no hay org.
- **GoogleReviewsTab**: lista vía `scopedFrom("google_reviews")`, inserts/updates/deletes inyectan/filtran `organization_id`. Cache key incluye `orgId`.
- **MunicipalitiesTab**: `scopedFrom("municipality_settings")`, save/del/toggle con `.eq("organization_id", orgId)`. Insert inyecta `organization_id`.
- **OverviewTab**: count de `sync_logs` ahora filtra por `organization_id` y depende de `orgId` en `useEffect`.
- **SeoContentTab**: `scopedFrom("seo_content")`, save/delete con `.eq("organization_id", orgId)`.
- **SeoTab**: `app_settings` updates/inserts inyectan/filtran `organization_id`.

## Sin cambios
- **AgendaTab**, **FiscalSettingsTab**: ya tenant-aware desde etapas previas.
- **CrmLeadsTab**: leads de la landing pública sistecpos.com — se mantiene global para superadmin.
