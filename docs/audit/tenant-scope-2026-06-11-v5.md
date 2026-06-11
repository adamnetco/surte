# Auditoría tenant-scope (refinada) — 2026-06-11

Archivos escaneados: **424**  ·  Hallazgos: **12**  
(high: 9, medium: 3, low: 0)

Generado por `scripts/audit-tenant-scope.ts` (Etapa 5).


## Top archivos a refactorizar (peso = high·5 + medium·2 + low·1)

- **10** — `supabase/functions/sitemap/index.ts`
- **5** — `src/lib/errors.ts`
- **5** — `src/modules/auth/pages/Login.tsx`
- **5** — `src/modules/onboarding/components/SubdomainPreview.tsx`
- **5** — `src/modules/storefront/components/AgentBar.tsx`
- **5** — `src/modules/superadmin/components/TenantOnboardingWizard.tsx`
- **5** — `src/modules/tenant/lib/subdomain.ts`
- **5** — `supabase/functions/send-web-push/index.ts`
- **4** — `src/modules/admin-cms/components/UsersTab.tsx`
- **2** — `src/modules/notifications/lib/pushClient.ts`

## Tablas más expuestas

- 3× → `profiles`
- 2× → `push_subscriptions`
- 1× → `x`
- 1× → `products`
- 1× → `categories`

## HIGH (9)


### `supabase/functions/sitemap/index.ts` (2)
- L246 · select() without organization_id filter · `products`
  ```supabase.from('products').select('slug, id, updated_at, image_url, name').eq('is_active', true).order('updated_at', { ascending: false })```
- L247 · select() without organization_id filter · `categories`
  ```supabase.from('categories').select('slug, name, updated_at, og_image_url').eq('is_active', true).order('sort_order')```

### `src/lib/errors.ts` (1)
- L96 · select() without organization_id filter · `x`
  ```supabase.from('x').select())```

### `src/modules/auth/pages/Login.tsx` (1)
- L45 · hardcoded 'surteya' slug
  ```const isSurteya = brand.slug === "surteya";```

### `src/modules/onboarding/components/SubdomainPreview.tsx` (1)
- L80 · hardcoded 'surteya' slug
  ```placeholder="surteya"```

### `src/modules/storefront/components/AgentBar.tsx` (1)
- L37 · select() without organization_id filter · `profiles`
  ```supabase.from("profiles").select("*")```

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

