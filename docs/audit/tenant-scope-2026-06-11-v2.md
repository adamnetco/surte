# Auditoría tenant-scope (refinada) — 2026-06-11

Archivos escaneados: **423**  ·  Hallazgos: **78**  
(high: 67, medium: 7, low: 4)

Generado por `scripts/audit-tenant-scope.ts` (Etapa 5).


## Top archivos a refactorizar (peso = high·5 + medium·2 + low·1)

- **25** — `src/modules/offline/lib/outbox.ts`
- **22** — `src/modules/pos/components/TableOrderDrawer.tsx`
- **20** — `supabase/functions/sitemap/index.ts`
- **15** — `src/modules/admin-cms/components/ProductsTab.tsx`
- **15** — `src/modules/admin-cms/pages/Compras.tsx`
- **15** — `src/modules/pos/components/CloseSessionDialog.tsx`
- **15** — `src/modules/storefront/pages/ProductoDetalle.tsx`
- **15** — `supabase/functions/invoice-ocr/index.ts`
- **10** — `src/modules/admin-cms/components/CouponsTab.tsx`
- **10** — `src/modules/admin-cms/components/FiscalSettingsTab.tsx`
- **10** — `src/modules/admin-cms/components/SeoContentTab.tsx`
- **10** — `src/modules/storefront/pages/Hub.tsx`
- **10** — `src/pages/GerenteIA.tsx`
- **10** — `supabase/functions/_shared/transactional-email-templates/organization-welcome.tsx`
- **8** — `src/modules/superadmin/pages/CatalogosBase.tsx`

## Tablas más expuestas

- 13× → `products`
- 4× → `table_order_items`
- 3× → `categories`
- 3× → `profiles`
- 3× → `pos_payments`
- 3× → `brands`
- 3× → `catalog_template_items`
- 2× → `coupons`
- 2× → `einvoice_configs`
- 2× → `landing_page_products`
- 2× → `product_media`
- 2× → `featured_sections`
- 2× → `seo_content`
- 2× → `shipping_zones`
- 2× → `supplier_products`

## HIGH (67)


### `src/modules/offline/lib/outbox.ts` (5)
- L123 · insert() without organization_id · `pos_order_items`
  ```supabase.from("pos_order_items").insert(lines)```
- L128 · insert() without organization_id · `pos_payments`
  ```supabase.from("pos_payments").insert(pays)```
- L135 · insert() without organization_id · `pos_payments`
  ```supabase.from("pos_payments").insert(payload)```
- L145 · insert() without organization_id · `pos_quotes`
  ```supabase.from("pos_quotes").insert(payload)```
- L150 · insert() without organization_id · `parked_tickets`
  ```supabase.from("parked_tickets").insert(payload)```

### `src/modules/pos/components/TableOrderDrawer.tsx` (4)
- L47 · select() without organization_id filter · `table_order_items`
  ```supabase.from("table_order_items").select("id,product_name,quantity,unit_price,total,status,notes")```
- L61 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id,name,price").eq("is_active", true).order("name").limit(120)```
- L78 · select() without organization_id filter · `table_order_items`
  ```supabase.from("table_order_items").select("total").eq("table_order_id", orderId)```
- L117 · select() without organization_id filter · `table_order_items`
  ```supabase.from("table_order_items") .select("id,product_name,quantity,notes,kitchen_station_id")```

### `supabase/functions/sitemap/index.ts` (4)
- L222 · select() without organization_id filter · `products`
  ```supabase.from('products').select('slug, id, updated_at, image_url, name').eq('is_active', true).order('updated_at', { ascending: false }),```
- L223 · select() without organization_id filter · `categories`
  ```supabase.from('categories').select('slug, name, updated_at, og_image_url').eq('is_active', true).order('sort_order'),```
- L224 · select() without organization_id filter · `brands`
  ```supabase.from('brands').select('slug, name, logo_url, created_at').eq('is_active', true).order('sort_order'),```
- L225 · select() without organization_id filter · `landing_pages`
  ```supabase.from('landing_pages').select('slug, updated_at, meta_title, image_url').eq('is_active', true),```

### `src/modules/admin-cms/components/ProductsTab.tsx` (3)
- L63 · insert() without organization_id · `product_media`
  ```supabase.from("product_media").insert({ product_id: productId, media_type: "image", media_url: url, sort_order: currentMax + i, })```
- L146 · select() without organization_id filter · `featured_sections`
  ```supabase.from("featured_sections").select("*").order("sort_order")```
- L354 · insert() without organization_id · `products`
  ```supabase.from("products").insert(payload).select("id, name, price, base_unit").single()```

### `src/modules/admin-cms/pages/Compras.tsx` (3)
- L154 · select() without organization_id filter · `supplier_products`
  ```supabase.from("supplier_products") .select("*, products(name, sku, gtin, image_url)")```
- L166 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id,name,sku").ilike("name", \`%${search}%\`).limit(10)```
- L269 · select() without organization_id filter · `purchase_orders`
  ```supabase.from("purchase_orders") .select("*, suppliers(name), purchase_order_items(*)")```

### `src/modules/pos/components/CloseSessionDialog.tsx` (3)
- L54 · select() without organization_id filter · `pos_payments`
  ```supabase.from("pos_payments").select("method,amount").eq("cash_session_id", sessionId),```
- L55 · select() without organization_id filter · `pos_orders`
  ```supabase.from("pos_orders").select("id", { count: "exact", head: true }).eq("cash_session_id", sessionId).eq("status", "paid"),```
- L56 · select() without organization_id filter · `cash_denominations`
  ```supabase.from("cash_denominations").select("id,value,kind").eq("currency", "COP").eq("is_active", true).order("value", { ascending: false }),```

### `src/modules/storefront/pages/ProductoDetalle.tsx` (3)
- L55 · select() without organization_id filter · `products`
  ```supabase.from("products").select("*, categories(name, slug)")```
- L69 · select() without organization_id filter · `product_media`
  ```supabase.from("product_media").select("*").eq("product_id", productId!).order("sort_order")```
- L79 · select() without organization_id filter · `product_presentations`
  ```supabase.from("product_presentations").select("*").eq("product_id", productId!).eq("is_active", true).order("sort_order")```

### `supabase/functions/invoice-ocr/index.ts` (3)
- L155 · select() without organization_id filter · `supplier_products`
  ```supabase.from("supplier_products").select("product_id") .eq("supplier_id", resolvedSupplierId).eq("supplier_sku", it.supplier_sku).maybeSingle()```
- L160 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id").eq("gtin", it.gtin).maybeSingle()```
- L164 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id") .ilike("name", \`%${it.description.slice(0, 24)}%\`).limit(1).maybeSingle()```

### `src/modules/admin-cms/components/CouponsTab.tsx` (2)
- L47 · select() without organization_id filter · `coupons`
  ```supabase.from("coupons").select("*").order("created_at", { ascending: false })```
- L87 · insert() without organization_id · `coupons`
  ```supabase.from("coupons").insert(payload)```

### `src/modules/admin-cms/components/FiscalSettingsTab.tsx` (2)
- L96 · insert() without organization_id · `einvoice_configs`
  ```supabase.from("einvoice_configs").update(payload as any).eq("id", cfg.id) : await supabase.from("einvoice_configs").insert(payload as any)```
- L97 · insert() without organization_id · `einvoice_configs`
  ```supabase.from("einvoice_configs").insert(payload as any)```

### `src/modules/admin-cms/components/SeoContentTab.tsx` (2)
- L67 · insert() without organization_id · `seo_content`
  ```supabase.from("seo_content").update(payload).eq("id", editing.id) : supabase.from("seo_content").insert(payload)```
- L68 · insert() without organization_id · `seo_content`
  ```supabase.from("seo_content").insert(payload)```

### `src/modules/storefront/pages/Hub.tsx` (2)
- L39 · select() without organization_id filter · `brands`
  ```supabase.from("brands").select("*").eq("is_active", true).order("sort_order")```
- L48 · select() without organization_id filter · `featured_sections`
  ```supabase.from("featured_sections").select("*").order("sort_order")```

### `src/pages/GerenteIA.tsx` (2)
- L111 · select() without organization_id filter · `invoice_scan_items`
  ```supabase.from("invoice_scan_items").select("*").eq("scan_id", s.id).order("line_no")```
- L257 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id,name,brand").ilike("name", \`%${q}%\`).limit(8)```

### `supabase/functions/_shared/transactional-email-templates/organization-welcome.tsx` (2)
- L82 · hardcoded 'surteya' slug
  ```org_name: 'Surteya',```
- L83 · hardcoded 'surteya' slug
  ```org_slug: 'surteya',```

### `src/lib/errors.ts` (1)
- L96 · select() without organization_id filter · `x`
  ```supabase.from('x').select())```

### `src/modules/admin-cms/components/AgendaTab.tsx` (1)
- L51 · select() without organization_id filter · `appointments`
  ```supabase.from("appointments") .select("*, service_catalog(name), service_resources(name)")```

### `src/modules/admin-cms/components/CategoriesTab.tsx` (1)
- L69 · insert() without organization_id · `categories`
  ```supabase.from("categories").insert(payload)```

### `src/modules/admin-cms/components/GoogleReviewsTab.tsx` (1)
- L44 · insert() without organization_id · `google_reviews`
  ```supabase.from("google_reviews").insert(payload)```

### `src/modules/admin-cms/components/InventoryTab.tsx` (1)
- L214 · insert() without organization_id · `products`
  ```supabase.from("products").insert(payload)```

### `src/modules/admin-cms/components/LandingPagesTab.tsx` (1)
- L213 · insert() without organization_id · `landing_page_products`
  ```supabase.from("landing_page_products").insert(rows)```

### `src/modules/admin-cms/components/ModifiersTab.tsx` (1)
- L66 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id, name, price, stock, image_url, base_unit").order("name")```

### `src/modules/admin-cms/components/PresentationsTab.tsx` (1)
- L27 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id, name, price, stock, base_unit").order("name")```

### `src/modules/admin-cms/components/ShippingTab.tsx` (1)
- L129 · insert() without organization_id · `shipping_zones`
  ```supabase.from("shipping_zones").insert(rows)```

### `src/modules/admin-cms/components/SyncMonitor.tsx` (1)
- L34 · select() without organization_id filter · `sync_logs`
  ```supabase.from("sync_logs").select("*").order("last_run_at", { ascending: false }).limit(200)```

### `src/modules/admin-cms/pages/AdminDashboard.tsx` (1)
- L177 · select() without organization_id filter · `categories`
  ```supabase.from("categories").select("*").order("sort_order")```

### `src/modules/admin-cms/pages/Inventario.tsx` (1)
- L51 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id, name, sku, image_url").in("id", productIds)```

### `src/modules/auth/pages/Login.tsx` (1)
- L45 · hardcoded 'surteya' slug
  ```const isSurteya = brand.slug === "surteya";```

### `src/modules/onboarding/components/SubdomainPreview.tsx` (1)
- L80 · hardcoded 'surteya' slug
  ```placeholder="surteya"```

### `src/modules/pos/pages/KDS.tsx` (1)
- L52 · select() without organization_id filter · `kds_tickets`
  ```supabase.from("kds_tickets").select("id,kitchen_station_id,dining_table_label,items,status,sent_at,started_at,ready_at,notes")```

### `src/modules/pos/pages/Mesas.tsx` (1)
- L48 · select() without organization_id filter · `dining_tables`
  ```supabase.from("dining_tables").select("id,label,capacity,pos_x,pos_y,width,height,shape,status,dining_area_id")```

### `src/modules/pos/pages/POS.tsx` (1)
- L46 · select() without organization_id filter · `cash_sessions`
  ```supabase.from("cash_sessions").select("id,location_id,cash_register_id,opening_amount,opened_at,status")```

### `src/modules/storefront/components/AgentBar.tsx` (1)
- L37 · select() without organization_id filter · `profiles`
  ```supabase.from("profiles").select("*")```

### `src/modules/storefront/components/BannerCarousel.tsx` (1)
- L20 · select() without organization_id filter · `banners`
  ```supabase.from("banners").select("*").eq("is_active", true).order("sort_order")```

### `src/modules/storefront/components/BrandsSection.tsx` (1)
- L13 · select() without organization_id filter · `brands`
  ```supabase.from("brands").select("*").eq("is_active", true).order("sort_order")```

### `src/modules/storefront/components/ModifierPicker.tsx` (1)
- L68 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id, name, stock, image_url").in("id", linkedIds)```

### `src/modules/storefront/components/TestimonialsSection.tsx` (1)
- L10 · select() without organization_id filter · `testimonials`
  ```supabase.from("testimonials").select("*").eq("is_active", true).order("sort_order")```

### `src/modules/storefront/pages/Carrito.tsx` (1)
- L164 · select() without organization_id filter · `shipping_zones`
  ```supabase.from("shipping_zones").select("*").eq("is_active", true).order("city").order("neighborhood")```

### `src/modules/superadmin/components/TenantOnboardingWizard.tsx` (1)
- L207 · hardcoded 'surteya' slug
  ```placeholder="Surteya"```

### `src/modules/superadmin/pages/CatalogosBase.tsx` (1)
- L111 · insert() without organization_id · `catalog_template_items`
  ```supabase.from("catalog_template_items").insert(chunk)```

### `src/modules/tenant/lib/subdomain.ts` (1)
- L12 · hardcoded 'surteya' slug
  ```*   surteya.sistecpos.com  → tenant slug 'surteya' (storefront del negocio)```

### `supabase/functions/send-web-push/index.ts` (1)
- L149 · select() without organization_id filter · `push_subscriptions`
  ```supabase.from("push_subscriptions").select("*").eq("is_active", true)```

## MEDIUM (7)


### `src/modules/admin-cms/components/UsersTab.tsx` (2)
- L76 · update/delete without id nor organization_id filter · `profiles`
  ```supabase.from("profiles").update({ business_type: value as BusinessType }).eq("user_id", userId)```
- L102 · update/delete without id nor organization_id filter · `profiles`
  ```supabase.from("profiles").update({ full_name: editForm.full_name, phone: editForm.phone, business_name: editForm.business_name, address: editForm.address, city:```

### `src/modules/admin-cms/components/LandingPagesTab.tsx` (1)
- L205 · update/delete without id nor organization_id filter · `landing_page_products`
  ```supabase.from("landing_page_products").delete().eq("landing_page_id", pageId)```

### `src/modules/notifications/lib/pushClient.ts` (1)
- L80 · update/delete without id nor organization_id filter · `push_subscriptions`
  ```supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", sub.endpoint)```

### `src/modules/pos/components/TableOrderDrawer.tsx` (1)
- L141 · update/delete without id nor organization_id filter · `table_order_items`
  ```supabase.from("table_order_items").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", itemIds)```

### `src/modules/superadmin/pages/CatalogosBase.tsx` (1)
- L130 · update/delete without id nor organization_id filter · `catalog_template_items`
  ```supabase.from("catalog_template_items").delete().eq("template_id", selected.id)```

### `src/modules/superadmin/pages/Licencias.tsx` (1)
- L183 · update/delete without id nor organization_id filter · `license_activations`
  ```supabase.from("license_activations") .update({ revoked_at: new Date().toISOString(), revoke_reason: "manual" })```

## LOW (4)


### `src/modules/superadmin/pages/Licencias.tsx` (3)
- L115 · select() without organization_id filter · `licenses`
  ```supabase.from("licenses").select("*").order("created_at", { ascending: false }), supabase.from("license_activations").select("*").order("last_heartbeat_at", { a```
- L116 · select() without organization_id filter · `license_activations`
  ```supabase.from("license_activations").select("*").order("last_heartbeat_at", { ascending: false }),```
- L119 · select() without organization_id filter · `onboarding_progress`
  ```supabase.from("onboarding_progress").select("organization_id,company_done,location_done,modules_done,einvoice_done,catalog_done,completed_at"),```

### `src/modules/superadmin/pages/CatalogosBase.tsx` (1)
- L52 · select() without organization_id filter · `catalog_template_items`
  ```supabase.from("catalog_template_items") .select("*").eq("template_id", t.id).order("sort_order").limit(500)```
