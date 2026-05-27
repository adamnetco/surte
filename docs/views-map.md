# Mapa de vistas (SistecPOS Core)

Inventario de cada página/vista, qué hace, qué datos consume y qué rol necesita. Sirve para construir/iterar cada pantalla por separado y reconectarlas al final.

Convenciones:
- **Ruta** → path en React Router.
- **Componente** → archivo en `src/pages/`.
- **Datos** → tablas (`t:`), RPCs (`rpc:`) y Edge Functions (`fn:`) que consume.
- **Rol** → mínimo necesario.

---

## 0. Entrada al sistema (Fase 0 · multi-tenant)

`detectTenant()` en `src/lib/subdomain.ts` decide qué se renderiza en `/`:

| Host | Renderiza | Notas |
|---|---|---|
| `sistecpos.com`, `www`, `app`, `admin`, `pos`, `mi` | `LoginRouter.tsx` | portal SaaS: 2 cards (Administrador / Cajero–Cliente) + auto-redirect según rol |
| `<slug>.sistecpos.com` (p.ej. `surteya.sistecpos.com`) | `Index.tsx` (storefront del tenant) | resolución vía rpc `resolve_tenant_by_host` |
| dominio custom verificado | `Index.tsx` del tenant | t: `tenant_domains` (verified_at) |

Path-based fallback: `/surteya/*` siempre renderiza el storefront de Surteya (catálogo, producto, carrito, etc.) aunque el host sea el dominio raíz — habilita migración progresiva a subdominios sin romper enlaces antiguos. `SurteyaRedirect.tsx` añade canonical SEO + 301 client-side.

| Ruta | Componente | Rol |
|---|---|---|
| `/` (host sistema) | `LoginRouter.tsx` | anon (redirige autenticado) |
| `/admin/login` | `Login.tsx` | anon — post-login → `/admin` |
| `/user/login` | `Login.tsx` | anon — post-login → `/clientes` |
| `/surteya`, `/surteya/catalogo`, `/surteya/producto/:slug`, `/surteya/carrito`, … | mismos componentes del storefront | público |

---

## A. Storefront público (sin login)

| Ruta | Componente | Datos | Notas |
|---|---|---|---|
| `/` | `Index.tsx` | t: `hero_slides`, `featured_sections`, `products`, `categories`, `banners`, `testimonials`, `gallery`, `google_reviews` | home mobile-first del tenant |
| `/catalogo` | `Catalogo.tsx` | t: `products`, `categories`, `brands` | grid + filtros |
| `/categorias` | `Categorias.tsx` | t: `categories` | listado de categorías |
| `/categoria/:slug` y `/hub/:slug` | `Hub.tsx` | t: `products`, `categories`, `brands`, `municipality_settings` | template dinámico para filtrar por categoría/marca/ciudad/tag |
| `/producto/:slug` | `ProductoDetalle.tsx` | t: `products`, `product_media`, `product_presentations`, `modifier_groups`, `modifier_options` | layout `h-[100dvh]`, badges arriba |
| `/ofertas` | `Ofertas.tsx` | t: `products` (tag oferta) | |
| `/menu/:slug?` | `MenuPage.tsx` | t: `categories`, `products`, `modifier_*` | modo carta restaurante |
| `/landing/:slug` | `LandingPage.tsx` | rpc: `get_landing_by_slug`, t: `landing_page_products` | CMS Tiptap |
| `/carrito` | `Carrito.tsx` | localStorage + t: `persistent_carts`, rpc: `upsert_persistent_cart`, fn: `send-whatsapp-order` | checkout WhatsApp |
| `/pedido/:orderNumber` | `Pedido.tsx` | t: `orders`, `order_items` (Realtime) | tracking |
| `/favoritos` | `Favoritos.tsx` | localStorage + t: `products` | |
| `/ayuda` | `Ayuda.tsx` | t: `app_settings` | FAQ |
| `/politicas`, `/tratamiento-datos`, `/unsubscribe` | `Politicas.tsx`, `TratamientoDatos.tsx`, `Unsubscribe.tsx` | t: `app_settings`, `email_unsubscribe_tokens` | legal |

---

## B. Cuenta de usuario (autenticado)

| Ruta | Componente | Datos | Rol |
|---|---|---|---|
| `/login` | `Login.tsx` | auth + `signInWithOAuth("google")` | anon |
| `/reset-password` | `ResetPassword.tsx` | auth: `updateUser({ password })` | recovery token |
| `/onboarding` | `Onboarding.tsx` | t: `profiles`, `onboarding_progress` | user |
| `/perfil` | `Perfil.tsx` | t: `profiles` | user |
| `/mis-pedidos` | `MisPedidos.tsx` | t: `orders`, `order_items` | user |
| `/clientes` | `clientes/ClientPortal.tsx` (+ tabs: dashboard, subscription, billing, tickets, downloads, trainings, contracts, POS access) | t: `subscriptions`, `subscription_invoices`, tickets, `desktop_releases`, `license_activations` | user |

---

## C. Admin / Backoffice  (`/admin`)

Protegido con `RoleGuard` + RPC `can_access_section` (autoriza por `admin_section_access.allowed_roles`).

| Ruta | Componente | Datos | Rol |
|---|---|---|---|
| `/admin` | `AdminDashboard.tsx` (tabs) | composición de todas las tabs | admin/editor/superadmin |
| `/admin/diag` | `AdminDiag.tsx` | rpc: `has_role`, `get_current_user_role`, `is_master_superadmin`, t: `admin_section_access` | abierto (diagnóstico) |
| `/catalogos-base` | `CatalogosBase.tsx` | t: `catalog_templates`, `catalog_template_items`, rpc: `apply_catalog_template` | superadmin |
| `/configuracion` | `Configuracion.tsx` | t: `app_settings`, `municipality_settings`, `shipping_zones` | admin |
| `/sitios` | `Sitios.tsx` | t: `tenant_sites`, `tenant_domains`, `tenant_wp_config`, fn: `verify-tenant-domain`, `sync-products-to-wp` | superadmin |
| `/licencias` | `Licencias.tsx` | t: `licenses`, `license_activations`, rpc: `create_license`, `revoke_activation`, `count_active_terminals` | superadmin |
| `/gerente-ia` | `GerenteIA.tsx` | t: `ai_insights`, fn: `ai-manager` | admin |

### Tabs del `AdminDashboard`

| Tab | Componente | Datos |
|---|---|---|
| Resumen | `OverviewTab.tsx` | agregaciones de `orders`, `products` |
| Productos | `ProductsTab.tsx` | t: `products`, `product_media`, `product_presentations`, `categories`, `brands` |
| Pedidos | `OrdersTab.tsx` | t: `orders`, `order_items`, fn: `sync-order`, `send-whatsapp-order` |
| Inventario | `InventoryTab.tsx` | t: `product_stock`, `stock_movements`, `warehouses`, rpc: `apply_stock_movement` |
| Categorías | `CategoriesTab.tsx` | t: `categories` |
| Marcas | `BrandsTab.tsx` | t: `brands` |
| Modificadores | `ModifiersTab.tsx` | t: `modifier_groups`, `modifier_options` |
| Presentaciones | `PresentationsTab.tsx` | t: `product_presentations` |
| Hero/Banners/Contenido | `HeroSlidesTab.tsx`, `ContentTab.tsx` | t: `hero_slides`, `banners`, `gallery`, `testimonials` |
| Secciones destacadas | `FeaturedSectionsTab.tsx` | t: `featured_sections` |
| Landings | `LandingPagesTab.tsx` | t: `landing_pages`, `landing_sections`, `landing_page_products` |
| Cupones | `CouponsTab.tsx` | t: `coupons`, rpc: `validate_coupon`, `redeem_coupon` |
| Usuarios | `UsersTab.tsx` | t: `profiles`, `user_roles`, `admin_section_access` |
| CRM Leads | `CrmLeadsTab.tsx` | t: `crm_leads` |
| Reviews Google | `GoogleReviewsTab.tsx` | t: `google_reviews`, fn: `fetch-google-reviews` |
| Reviews clientes | `CustomerReviewsTab.tsx` | t: `customer_reviews` |
| Municipios | `MunicipalitiesTab.tsx` | t: `municipality_settings` |
| Envíos | `ShippingTab.tsx` | t: `shipping_zones` |
| Agenda | `AgendaTab.tsx` | t: `appointments`, `service_resources`, rpc: `get_resource_availability` |
| Notificaciones | `NotificationsTab.tsx` | t: `notification_subscriptions`, `push_subscriptions`, fn: `send-web-push` |
| Scripts | `ScriptsTab.tsx` | t: `custom_scripts` |
| SEO | `SeoTab.tsx`, `SeoContentTab.tsx` | t: `seo_content`, `app_settings` |
| Settings | `SettingsTab.tsx` | t: `app_settings` (paleta dinámica por id_negocio) |
| Modos POS | `POSModesSettings.tsx` | t: `app_settings` (perfiles de POS por tipo de negocio) |
| Módulos | `ModulesTab.tsx` | t: `modules`, `organization_modules`, `plan_modules` |
| Sincronización | `SyncStatusTable.tsx` + `DeadLetterQueue.tsx` *(Fase 3)* | rpc: `get_recent_sync_logs`, t: `sync_outbox` (Realtime), fn: `sync-outbox-retry` |
| Data | `DataManagementTab.tsx` | importadores CSV resilientes |
| Acceso por sección | `AdminSectionAccess.tsx` | t: `admin_section_access` |

---

## D. Operación / POS / ERP

| Ruta | Componente | Datos | Rol |
|---|---|---|---|
| `/pos` | `POS.tsx` *(envuelto en `POSErrorBoundary` — Fase 4)* + `pos/POSWorkspace.tsx` | t: `pos_orders`, `pos_order_items`, `pos_payments`, `pos_quotes`, `parked_tickets`, `cash_registers`, `cash_sessions`, offline `Dexie`, sub-componentes: `POSTopBar`, `POSCategoryTabs`, `POSModeBar`, `POSCustomerPicker`, `CustomerQuickDialog`, `TableGridSheet`, `DriverPickerSheet`, `PaymentDialog`, `InvoiceActionsDialog`, `POSCommandPalette`, `POSScannerListener`, `POSShortcutsOverlay` | admin/editor/cajero |
| `/kds` | `KDS.tsx` | t: `kds_tickets`, `kitchen_stations` (Realtime) | editor/cocina |
| `/mesas` | `Mesas.tsx` | t: `dining_areas`, `dining_tables`, `table_orders`, `table_order_items` | editor/mesero |
| `/inventario` | `Inventario.tsx` | t: `product_stock`, `stock_movements`, `warehouses` | admin |
| `/compras` | `Compras.tsx` | t: `suppliers`, `supplier_products`, `purchase_orders`, `purchase_order_items`, `invoice_scans`, rpc: `receive_purchase_order`, `apply_invoice_scan`, `rematch_invoice_scan`, fn: `invoice-ocr` | admin |
| `/facturacion` | `Facturacion.tsx` | t: `einvoice_configs`, `electronic_invoices`, `einvoice_events`, fn: `innapsis-emit`, `innapsis-status` | admin |
| `/billing` | `Billing.tsx` | t: `subscriptions`, `subscription_invoices`, `dunning_events`, `saas_plans` | superadmin |
| `/planes` | `Planes.tsx` | t: `saas_plans`, `plan_modules` | público |

---

## E. Infraestructura transversal (montada en `App.tsx`)

| Componente | Propósito |
|---|---|
| `AuthProvider` | sesión Supabase + caché de rol en `localStorage` (anti-flash) |
| `OrganizationProvider` | org actual + módulos contratados (`hasModule`) |
| `ThemeContext` + `DynamicThemeInjector` | inyecta paleta del tenant como CSS vars |
| `CartProvider` + `OmnichannelCartListener` + `CartNavigationGuard` | carrito persistente + sync Realtime + bloqueo navegación con items |
| `AgentContext` + `AgentBar` | modo agente (ventas proxy CLI-0001) |
| `SwipeContext` + `ProductSwipeOverlay` | modo catálogo de ventas |
| `CustomScriptInjector` | tracking pixels DB-driven |
| `OfflineIndicator` + `useSyncService` | estado online/offline + flush outbox |
| `PushOptIn` | suscripción Web Push |
| `FloatingWhatsApp` | botón soporte (bottom-36) |
| `POSErrorBoundary` *(Fase 4)* | aísla crashes del POS sin perder ticket |
| `SurteyaRedirect` *(Fase 0)* | redirige paths legacy → `/surteya/*` + canonical |

### Presets reutilizables (Fase 4)

`src/components/ui/skeleton-presets.tsx` exporta `TableSkeleton`, `CardGridSkeleton`, `FormSkeleton`, `StatGridSkeleton` para garantizar estados de carga consistentes en todas las vistas administrativas.

---

## F. Edge Functions activas

| Función | `verify_jwt` | Consume |
|---|---|---|
| `resolve-tenant` | no | host → tenant_sites (cache CDN) |
| `cart-sync` | no | persistent_carts + Realtime |
| `send-whatsapp-order`, `send-ycloud-whatsapp`, `broadcast-whatsapp-ycloud`, `send-callmebot` | no/sí | YCloud + fallback wa.me |
| `process-email-queue`, `send-transactional-email`, `preview-transactional-email`, `resend-mail-service`, `handle-email-unsubscribe`, `handle-email-suppression`, `auth-email-hook` | mixto | Resend + pgmq |
| `send-web-push`, `get-vapid-public-key`, `process-scheduled-broadcasts` | mixto | web-push + VAPID |
| `sync-order`, `sync-products-to-wp`, `wp-revalidate-webhook` | mixto | WordPress headless |
| `sync-outbox-flush`, `sync-outbox-retry` *(Fases 2-3)* | sí | tabla `sync_outbox` con backoff + jitter ±20 % |
| `innapsis-emit`, `innapsis-status` | sí | facturación electrónica Innapsis |
| `invoice-ocr` | sí | OCR de facturas → `invoice_scans` |
| `optimize-image` | no | bucket `product-images` → WebP |
| `license-issue`, `license-activate`, `license-heartbeat`, `license-purchase-webhook` | mixto | POS desktop |
| `sso-issue`, `sso-consume`, `auth-global-logout` | mixto | SSO cross-subdomain + logout global |
| `sitemap`, `get-landing`, `lead-capture` | no | SEO + CMS público |
| `fetch-google-reviews` | sí | Places API |
| `ai-manager` | sí | LOVABLE_API_KEY (Gerente IA) |
| `verify-tenant-domain` | sí | TXT challenge para dominios custom |

---

## G. Seguridad — postura actual (post Fase 1)

- **Funciones SECURITY DEFINER**: `EXECUTE` revocado a `PUBLIC`. Granular por rol (ver `security memory`):
  - **anon**: `resolve_tenant_by_host`, `get_landing_by_slug`, `validate_coupon`, `get/upsert/complete_persistent_cart`, `register_activation`, `heartbeat_activation`.
  - **authenticated**: helpers RBAC + operaciones POS/inventario/compras/cupones/sync/agenda.
  - **service_role**: `cleanup_sso_tokens`, helpers pgmq.
  - **sin grant** (triggers internos): `handle_new_user`, `auto_create_base_presentation`, etc.
- **`sso_handoff_tokens`**: policy RESTRICTIVE `USING (false)` para anon + authenticated. Acceso únicamente vía edge functions con `service_role`.
- **Buckets públicos** (`product-images`, `desktop-releases`): intencionalmente listables (catálogo / instaladores).

---

## Tips para construir vistas aisladas

1. Cada página debe poder renderizarse con **datos mock** sin crashear (props defaults o early-return loading + skeleton-presets).
2. Aísla queries en `src/hooks/use*.ts` para que la vista solo consuma el hook.
3. Para vistas con permisos, envuelve en `RoleGuard` con `section="<section_key>"` (autoriza vía `admin_section_access`).
4. Antes de conectar a producción, prueba el endpoint en Postman con la colección y verifica que el JSON coincide con `src/integrations/supabase/types.ts`.
5. Para flujos del POS, envuelve nuevas vistas en `POSErrorBoundary` si manejan estado crítico no recuperable de servidor.
