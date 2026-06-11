---
name: SaaS Refactor — Etapa 7
description: useStore hooks tenant-aware + storefront ProductoDetalle/LandingPage scoping + admin tabs (Categorías, Productos, Cupones) con organization_id explícito
type: feature
---

# Etapa 7 — Hooks storefront + páginas + tabs admin restantes

## Frontend

### `src/modules/storefront/hooks/useStore.ts`
- `useInactiveBrands`, `useCategories`, `useProducts`, `useAppSettings`
  reciben `orgId?: string | null` opcional y por defecto resuelven el tenant
  vía `useTenantOrgId()` (`@/modules/tenant/lib/useTenantSite`).
- Toda query incluye `.eq("organization_id", effectiveOrgId)`.
- `enabled: !!effectiveOrgId` (excepto `useAppSettings`, que mantiene
  comportamiento legacy si no hay tenant todavía).
- `queryKey` lleva `effectiveOrgId` para aislar caché por organización.

### Páginas storefront
- **ProductoDetalle.tsx**: query `product` filtra por `organization_id` del
  tenant (`useTenantOrgId`) + `id`/`slug`, evitando colisiones cross-tenant.
- **LandingPage.tsx**: query `landing_pages` filtra por `organization_id`
  además del slug.
- **Catalogo / Ofertas / Hub / Carrito / Pedido**: ya pasaban por
  `useProducts/useCategories/useAppSettings`, así que heredan automáticamente
  el filtro tenant gracias al refactor de hooks.

### Admin tabs (escopado explícito)
- **CategoriesTab**: `currentOrg.id` requerido en `insert` (`Selecciona una
  organización` si falta). Update/delete siguen confiando en RLS.
- **CouponsTab**: lista vía `scopedFrom("coupons", currentOrg.id)`;
  `insert` inyecta `organization_id`.
- **ProductsTab**: `insert` de producto inyecta `organization_id`;
  `useInactiveBrands` recibe `currentOrg.id` para consistencia con admin.

## Notas
- `useAppSettings` deja el filtro como opcional para no romper rutas que aún
  cargan settings antes de resolver tenant; se irá ajustando cuando `app_settings`
  pase a ser estrictamente tenant-only.
- Tabs admin pendientes con SELECT/INSERT sin scope explícito (a tratar en
  Etapa 8): `OrdersTab`, `InventoryTab`, `CustomerReviewsTab`,
  `MunicipalitiesTab`, `NotificationsTab`, `OrganizationsTab`,
  `SeoContentTab`, `SettingsTab`, `UsersTab`, `DataManagementTab`.
- `OrganizationsTab` opera sobre la metatabla del SaaS — debe usar role
  superadmin y NO filtrarse por tenant.
