# Mapa de vistas (SURTÉ YA)

Inventario de cada página/vista, qué hace, qué datos consume y qué rol necesita. Sirve para construir/iterar cada pantalla por separado y reconectarlas al final.

Convenciones:
- **Ruta** → path en React Router.
- **Componente** → archivo en `src/pages/`.
- **Datos** → tablas (`t:`), RPCs (`rpc:`) y Edge Functions (`fn:`) que consume.
- **Rol** → mínimo necesario.

---

## A. Storefront público (sin login)

| Ruta | Componente | Datos | Notas |
|---|---|---|---|
| `/` | `Index.tsx` | t: `hero_slides`, `featured_sections`, `products`, `categories`, `banners`, `testimonials`, `gallery`, `google_reviews` | home mobile-first |
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
| `/login` | `Login.tsx` | auth + `lovable.auth.signInWithOAuth("google")` | anon |
| `/reset-password` | `ResetPassword.tsx` | auth: `updateUser({ password })` | recovery token |
| `/onboarding` | `Onboarding.tsx` | t: `profiles`, `onboarding_progress` | user |
| `/perfil` | `Perfil.tsx` | t: `profiles` | user |
| `/mis-pedidos` | `MisPedidos.tsx` | t: `orders`, `order_items` | user |

---

## C. Admin / Backoffice  (`/admin`)

Protegido con `RoleGuard` + RPC `can_access_section`.

| Ruta | Componente | Datos | Rol |
|---|---|---|---|
| `/admin` | `AdminDashboard.tsx` (tabs) | composición de todas las tabs | admin/editor/superadmin |
| `/admin/diag` | `AdminDiag.tsx` | rpc: `has_role`, `get_current_user_role`, `is_master_superadmin`, t: `admin_section_access` | abierto (diagnóstico) |
| `/catalogos-base` | `CatalogosBase.tsx` | t: `catalog_templates`, `catalog_template_items`, rpc: `apply_catalog_template` | superadmin |
| `/configuracion` | `Configuracion.tsx` | t: `app_settings`, `municipality_settings`, `shipping_zones` | admin |
| `/sitios` | `Sitios.tsx` | t: `tenant_sites`, `tenant_domains`, `tenant_wp_config`, fn: `verify-tenant-domain`, `sync-products-to-wp` | superadmin |
| `/licencias` | `Licencias.tsx` | t: `licenses`, `license_activations`, rpc: `create_license`, `revoke_activation` | superadmin |
| `/gerente-ia` | `GerenteIA.tsx` | t: `ai_insights`, fn: `ai-manager` | admin |

Tabs del `AdminDashboard`:

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
| Hero/Banners | `HeroSlidesTab.tsx`, contenido en `ContentTab.tsx` | t: `hero_slides`, `banners`, `gallery`, `testimonials` |
| Secciones destacadas | `FeaturedSectionsTab.tsx` | t: `featured_sections` |
| Landings | `LandingPagesTab.tsx` | t: `landing_pages`, `landing_sections`, `landing_page_products` |
| Cupones | `CouponsTab.tsx` | t: `coupons`, rpc: `validate_coupon` |
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
| Módulos | `ModulesTab.tsx` | t: `modules`, `organization_modules`, `plan_modules` |
| Data | `DataManagementTab.tsx` | importadores CSV resilientes |
| Acceso por sección | `AdminSectionAccess.tsx` | t: `admin_section_access` |

---

## D. Operación / POS / ERP

| Ruta | Componente | Datos | Rol |
|---|---|---|---|
| `/pos` | `POS.tsx` + `pos/POSWorkspace.tsx` | t: `pos_orders`, `pos_order_items`, `pos_payments`, `pos_quotes`, `parked_tickets`, offline `Dexie` | admin/editor |
| `/kds` | `KDS.tsx` | t: `kds_tickets`, `kitchen_stations` (Realtime) | editor |
| `/mesas` | `Mesas.tsx` | t: `dining_areas`, `dining_tables`, `table_orders`, `table_order_items` | editor |
| `/inventario` | `Inventario.tsx` | t: `product_stock`, `stock_movements`, `warehouses` | admin |
| `/compras` | `Compras.tsx` | t: `suppliers`, `supplier_products`, `purchase_orders`, `purchase_order_items`, `invoice_scans`, rpc: `receive_purchase_order`, `apply_invoice_scan`, fn: `invoice-ocr` | admin |
| `/facturacion` | `Facturacion.tsx` | t: `einvoice_configs`, `electronic_invoices`, `einvoice_events`, fn: `innapsis-emit`, `innapsis-status` | admin |
| `/billing` | `Billing.tsx` | t: `subscriptions`, `subscription_invoices`, `dunning_events`, `saas_plans` | superadmin |
| `/planes` | `Planes.tsx` | t: `saas_plans`, `plan_modules` | público |

---

## Tips para construir vistas aisladas

1. Cada página debe poder renderizarse con **datos mock** sin crashear (props defaults o early-return loading).
2. Aísla queries en `src/hooks/use*.ts` para que la vista solo consuma el hook.
3. Para vistas con permisos, envuelve en `RoleGuard` con `requireSection="<section_key>"`.
4. Antes de conectar a producción, prueba el endpoint en Postman con la colección y verifica que el JSON coincide con `src/integrations/supabase/types.ts`.
