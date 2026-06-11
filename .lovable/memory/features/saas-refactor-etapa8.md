---
name: SaaS Refactor — Etapa 8
description: Tabs admin restantes (Inventory, Customer Reviews, Notifications, Settings, Users) escopados por organization_id explícito + filtros tenant en list queries
type: feature
---

# Etapa 8 — Admin tabs restantes con tenant scope

## Frontend cambios

### InventoryTab
- Importación CSV/XLS: inserts de productos inyectan `organization_id` del
  `currentOrg`. Si no hay org seleccionada, agrega error por fila en lugar de
  fallar el batch.

### CustomerReviewsTab
- Filtro tenant en cliente sobre el RPC `admin_list_customer_reviews()`
  (que sigue devolviendo todas las reviews por compatibilidad).
- Updates de approval/active/response incluyen `.eq("organization_id", currentOrg.id)`
  como defensa adicional contra RLS bypass.
- TODO: trasladar el filtro al RPC en una iteración futura con `current_org_id()`.

### NotificationsTab
- `notification_subscriptions`, `broadcast_logs`: list queries usan
  `scopedFrom(tabla, currentOrg.id)`.
- `app_settings` para YCloud filtrado por `organization_id`.
- `WebPushSection` ahora recibe `orgId` como prop y filtra el conteo de
  `push_subscriptions` por tenant. Cast a `any` para evitar inferencia
  excesiva en `count: exact, head: true`.

### SettingsTab
- Insert de nuevo `app_settings` requiere `currentOrg.id` y lo inyecta.
- Updates por id siguen confiando en RLS (RLS valida pertenencia tenant).

### UsersTab
- List de `profiles` filtra por `organization_id = currentOrg.id` (cada admin
  ve sólo miembros de su organización).
- Creación de usuario añade `organization_slug` en `raw_user_meta_data` para
  que `handle_new_user()` vincule al tenant correcto.
- `user_roles` permanece global (RBAC cross-tenant); roles se actualizan por
  `id`/`user_id` con RLS de superadmin/admin.

### OrdersTab y DataManagementTab
- OrdersTab: sólo updates por `id` → RLS suficiente, no requirió cambios.
- DataManagementTab: no toca tablas directamente, usa edge functions.

## Pendientes próximos
- Migrar `admin_list_customer_reviews()` para filtrar por `current_org_id()`.
- Auditar tabs platform-level: `OrganizationsTab`, `ModulesTab`, `LicenseTab`
  (deben funcionar sin scope tenant porque operan a nivel SaaS).
- Revisar tabs especializados (`OverviewTab`, `SeoTab`, `SeoContentTab`,
  `MunicipalitiesTab`, `FiscalSettingsTab`, `AgendaTab`, `ContactsTab`,
  `CrmLeadsTab`, `GoogleReviewsTab`) en Etapa 9.
