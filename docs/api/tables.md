# Tablas (esquema `public`)

Acceso REST: `GET /rest/v1/<tabla>?<filtros>` — devuelve JSON.
Toda tabla tiene RLS activado salvo que se indique lo contrario.

> Convención: omitimos columnas estándar (`id uuid`, `created_at`, `updated_at`) salvo cuando aportan algo.

---

## Catálogo

### `products`
Productos del e-commerce y POS.
**Columnas clave:** `name`, `slug`, `description`, `brand`, `category_id`, `sku`, `gtin`, `price`, `price_wholesale`, `original_price`, `cost_price`, `image_url`, `unit`, `unit_quantity`, `unit_measure`, `net_weight_grams`, `stock`, `tags text[]`, `availability`, `available_from`, `available_until`, `available_days int[]`, `available_time_start`, `available_time_end`, `is_active`, `meta_title`, `meta_description`, `organization_id`.
**RLS:** lectura pública si `is_active`. Escritura: `admin` / `editor` / `superadmin`.

### `products_public`
Vista de solo lectura para storefront, sin precios de costo.

### `categories`
`name`, `slug`, `icon`, `sort_order`, `parent_id`, `meta_title`, `meta_description`, `og_image_url`, `is_active`, `organization_id`.

### `brands`
`name`, `logo_url`, `is_active` (ocultar la marca oculta sus productos).

### `product_presentations`
Presentaciones por producto (unidad, caja, fardo): `product_id`, `name`, `conversion_factor`, `price`, `sort_order`, `is_active`.
Trigger `auto_create_base_presentation` crea la base al insertar un producto.

### `product_media`
Galería: `product_id`, `media_type` (`image|video|pdf`), `url`, `sort_order`, `is_default`.

### `modifier_groups` / `modifier_options`
Modificadores tipo "elige toppings". Opciones soportan `linked_product_id` y modo `max_price`.

---

## Pedidos y carrito

### `orders`
`order_number`, `status`, `customer_name`, `customer_email`, `customer_phone`, `customer_address`, `city`, `subtotal`, `delivery_price`, `discount`, `total`, `notes`, `payment_method`, `user_id`, `agent_id`, `external_sync_status`, `external_sync_sent_at`, `cart_token`.
**RLS:** el dueño (`user_id = auth.uid()`) o staff (admin/editor/superadmin).

### `order_items`
`order_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `total_price`, `presentation_id`, `modifiers jsonb`.

### `persistent_carts`
Carrito omnicanal con `cart_token uuid`, `items jsonb`, `subtotal`, `total_items`, `phone`, `channel` (`web|whatsapp|pos`), `status` (`active|completed|abandoned`), `expires_at`.
Usa RPCs `upsert_persistent_cart`, `get_persistent_cart`, `complete_persistent_cart`.

---

## Usuarios y roles

### `profiles`
`user_id` (FK `auth.users`), `full_name`, `phone`, `business_type` (`casa|minimercado|horeca|salsamentaria|mayorista`), `customer_code` (CLI-0000), `address`, `city`, `avatar_url`.

### `user_roles`
`user_id`, `role app_role`. Helpers: `has_role`, `has_any_role`, `get_current_user_role`, `is_master_superadmin`.

### `admin_section_access`
`section_key`, `allowed_roles app_role[]`. Función `can_access_section(_section)` lo usa para autorizar tabs del admin.

---

## Inventario / Compras

`warehouses`, `product_stock`, `stock_movements`, `stock_transfers`, `stock_transfer_items`, `suppliers`, `supplier_products`, `purchase_orders`, `purchase_order_items`, `invoice_scans`, `invoice_scan_items`.

RPCs: `apply_stock_movement`, `receive_purchase_order`, `apply_invoice_scan`, `rematch_invoice_scan`.

---

## POS

`pos_orders`, `pos_order_items`, `pos_payments`, `pos_quotes`, `parked_tickets`, `cash_registers`, `cash_sessions`, `cash_movements`, `kitchen_stations`, `kds_tickets`, `dining_areas`, `dining_tables`, `table_orders`, `table_order_items`.

---

## Facturación electrónica

`einvoice_configs`, `einvoice_events`, `electronic_invoices` (integración Innapsis vía edge functions `innapsis-emit`, `innapsis-status`).

---

## CMS / Marketing

`hero_slides`, `banners`, `featured_sections`, `landing_pages`, `landing_sections`, `landing_page_products`, `gallery`, `testimonials`, `customer_reviews`, `google_reviews`, `seo_content`, `coupons`, `crm_leads`, `custom_scripts`.

RPCs: `validate_coupon`, `redeem_coupon`, `get_landing_by_slug`.

---

## Multi-tenant / Org

`organizations`, `organization_members`, `organization_modules`, `org_signup_requests`, `modules`, `plan_modules`, `saas_plans`, `subscriptions`, `subscription_invoices`, `dunning_events`, `usage_events`.

Helpers: `is_member_of`, `org_role`, `user_orgs`, `default_org_id`, `has_module`, `log_usage`.

---

## Tenants headless (Astro / WP)

`tenant_sites`, `tenant_domains`, `tenant_wp_config`, `tenant_sync_log`.
RPC: `resolve_tenant_by_host`.

---

## Licencias desktop

`licenses`, `license_activations`, `license_audit`, `desktop_releases`.
RPCs: `create_license`, `register_activation`, `heartbeat_activation`, `revoke_activation`, `count_active_terminals`.

---

## Email / Notificaciones / Push

`app_settings`, `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`, `notification_subscriptions`, `push_subscriptions`, `push_broadcast_logs`, `broadcast_logs`.

---

## Servicios / Agenda

`service_types`, `service_catalog`, `service_resources`, `appointments`.
RPC: `get_resource_availability`.

---

## Otros

`ai_insights`, `catalog_templates`, `catalog_template_items`, `catalog_template_applications`, `locations`, `municipality_settings`, `shipping_zones`, `onboarding_progress`.

RPC catálogo base: `apply_catalog_template`.

---

## Listado completo

`admin_section_access, ai_insights, app_settings, appointments, banners, brands, broadcast_logs, cash_movements, cash_registers, cash_sessions, catalog_template_applications, catalog_template_items, catalog_templates, categories, coupons, crm_leads, custom_scripts, customer_reviews, desktop_releases, dining_areas, dining_tables, dunning_events, einvoice_configs, einvoice_events, electronic_invoices, email_send_log, email_send_state, email_unsubscribe_tokens, featured_sections, gallery, google_reviews, hero_slides, invoice_scan_items, invoice_scans, kds_tickets, kitchen_stations, landing_page_products, landing_pages, landing_sections, license_activations, license_audit, licenses, locations, modifier_groups, modifier_options, modules, municipality_settings, notification_subscriptions, onboarding_progress, order_items, orders, org_signup_requests, organization_members, organization_modules, organizations, parked_tickets, persistent_carts, plan_modules, pos_order_items, pos_orders, pos_payments, pos_quotes, product_media, product_presentations, product_stock, products, products_public, profiles, purchase_order_items, purchase_orders, push_broadcast_logs, push_subscriptions, saas_plans, seo_content, service_catalog, service_resources, service_types, shipping_zones, stock_movements, stock_transfer_items, stock_transfers, subscription_invoices, subscriptions, supplier_products, suppliers, suppressed_emails, table_order_items, table_orders, tenant_domains, tenant_sites, tenant_sync_log, tenant_wp_config, testimonials, usage_events, user_roles, warehouses.`

Para ver columnas exactas de cualquier tabla en local:

```bash
psql "$SUPABASE_DB_URL" -c "\d public.<tabla>"
```

O consulta `src/integrations/supabase/types.ts` (auto-generado, tiene los tipos TS de cada columna).
