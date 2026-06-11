# Auditoría tenant-scope (refinada) — 2026-06-11

Archivos escaneados: **424**  ·  Hallazgos: **23**  
(high: 20, medium: 3, low: 0)

Generado por `scripts/audit-tenant-scope.ts` (Etapa 5).


## Top archivos a refactorizar (peso = high·5 + medium·2 + low·1)

- **20** — `supabase/functions/sitemap/index.ts`
- **5** — `src/lib/errors.ts`
- **5** — `src/modules/admin-cms/components/AgendaTab.tsx`
- **5** — `src/modules/admin-cms/components/SyncMonitor.tsx`
- **5** — `src/modules/admin-cms/pages/AdminDashboard.tsx`
- **5** — `src/modules/admin-cms/pages/Compras.tsx`
- **5** — `src/modules/auth/pages/Login.tsx`
- **5** — `src/modules/onboarding/components/SubdomainPreview.tsx`
- **5** — `src/modules/storefront/components/AgentBar.tsx`
- **5** — `src/modules/storefront/components/BannerCarousel.tsx`
- **5** — `src/modules/storefront/components/BrandsSection.tsx`
- **5** — `src/modules/storefront/components/ModifierPicker.tsx`
- **5** — `src/modules/storefront/components/TestimonialsSection.tsx`
- **5** — `src/modules/storefront/pages/Carrito.tsx`
- **5** — `src/modules/superadmin/components/TenantOnboardingWizard.tsx`

## Tablas más expuestas

- 3× → `profiles`
- 2× → `categories`
- 2× → `push_subscriptions`
- 2× → `brands`
- 2× → `products`
- 1× → `x`
- 1× → `appointments`
- 1× → `sync_logs`
- 1× → `purchase_orders`
- 1× → `banners`
- 1× → `testimonials`
- 1× → `shipping_zones`
- 1× → `landing_pages`

## HIGH (20)


### `supabase/functions/sitemap/index.ts` (4)
- L246 · select() without organization_id filter · `products`
  ```supabase.from('products').select('slug, id, updated_at, image_url, name').eq('is_active', true).order('updated_at', { ascending: false })```
- L247 · select() without organization_id filter · `categories`
  ```supabase.from('categories').select('slug, name, updated_at, og_image_url').eq('is_active', true).order('sort_order')```
- L248 · select() without organization_id filter · `brands`
  ```supabase.from('brands').select('slug, name, logo_url, created_at').eq('is_active', true).order('sort_order')```
- L249 · select() without organization_id filter · `landing_pages`
  ```supabase.from('landing_pages').select('slug, updated_at, meta_title, image_url').eq('is_active', true)```

### `src/lib/errors.ts` (1)
- L96 · select() without organization_id filter · `x`
  ```supabase.from('x').select())```

### `src/modules/admin-cms/components/AgendaTab.tsx` (1)
- L51 · select() without organization_id filter · `appointments`
  ```supabase.from("appointments") .select("*, service_catalog(name), service_resources(name)")```

### `src/modules/admin-cms/components/SyncMonitor.tsx` (1)
- L34 · select() without organization_id filter · `sync_logs`
  ```supabase.from("sync_logs").select("*").order("last_run_at", { ascending: false }).limit(200)```

### `src/modules/admin-cms/pages/AdminDashboard.tsx` (1)
- L178 · select() without organization_id filter · `categories`
  ```supabase.from("categories").select("*")```

### `src/modules/admin-cms/pages/Compras.tsx` (1)
- L275 · select() without organization_id filter · `purchase_orders`
  ```supabase.from("purchase_orders") .select("*, suppliers(name), purchase_order_items(*)")```

### `src/modules/auth/pages/Login.tsx` (1)
- L45 · hardcoded 'surteya' slug
  ```const isSurteya = brand.slug === "surteya";```

### `src/modules/onboarding/components/SubdomainPreview.tsx` (1)
- L80 · hardcoded 'surteya' slug
  ```placeholder="surteya"```

### `src/modules/storefront/components/AgentBar.tsx` (1)
- L37 · select() without organization_id filter · `profiles`
  ```supabase.from("profiles").select("*")```

### `src/modules/storefront/components/BannerCarousel.tsx` (1)
- L22 · select() without organization_id filter · `banners`
  ```supabase.from("banners").select("*").eq("is_active", true).order("sort_order")```

### `src/modules/storefront/components/BrandsSection.tsx` (1)
- L15 · select() without organization_id filter · `brands`
  ```supabase.from("brands").select("*").eq("is_active", true).order("sort_order")```

### `src/modules/storefront/components/ModifierPicker.tsx` (1)
- L70 · select() without organization_id filter · `products`
  ```supabase.from("products").select("id, name, stock, image_url").in("id", linkedIds)```

### `src/modules/storefront/components/TestimonialsSection.tsx` (1)
- L12 · select() without organization_id filter · `testimonials`
  ```supabase.from("testimonials").select("*").eq("is_active", true).order("sort_order")```

### `src/modules/storefront/pages/Carrito.tsx` (1)
- L166 · select() without organization_id filter · `shipping_zones`
  ```supabase.from("shipping_zones").select("*").eq("is_active", true).order("city").order("neighborhood")```

### `src/modules/superadmin/components/TenantOnboardingWizard.tsx` (1)
- L207 · hardcoded 'surteya' slug
  ```placeholder="Surteya"```

### `src/modules/tenant/lib/subdomain.ts` (1)
- L12 · hardcoded 'surteya' slug
  ```*   surteya.sistecpos.com  → tenant slug 'surteya' (storefront del negocio)```

### `supabase/functions/send-web-push/index.ts` (1)
- L149 · select() without organization_id filter · `push_subscriptions`
  ```supabase.from("push_subscriptions").select("*").eq("is_active", true)```

## MEDIUM (3)


### `src/modules/admin-cms/components/UsersTab.tsx` (2)
- L82 · update/delete without id nor organization_id filter · `profiles`
  ```supabase.from("profiles").update({ business_type: value as BusinessType }).eq("user_id", userId)```
- L108 · update/delete without id nor organization_id filter · `profiles`
  ```supabase.from("profiles").update({ full_name: editForm.full_name, phone: editForm.phone, business_name: editForm.business_name, address: editForm.address, city:```

### `src/modules/notifications/lib/pushClient.ts` (1)
- L80 · update/delete without id nor organization_id filter · `push_subscriptions`
  ```supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", sub.endpoint)```

## LOW (0)

