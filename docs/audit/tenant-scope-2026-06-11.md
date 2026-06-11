# Auditoría tenant-scope — 2026-06-11

Archivos escaneados: **420**  ·  Hallazgos: **330**  
(high: 5, medium: 322, low: 3)

Generado por `scripts/audit-tenant-scope.ts` — Etapa 1 del refactor SaaS.


## HIGH (5)


### `src/components/SurteyaRedirect.tsx` (1)
- L16 · hardcoded 'surteya' slug
  ```const LEGACY_TENANT_SLUG = "surteya";```

### `src/modules/auth/pages/Login.tsx` (1)
- L45 · hardcoded 'surteya' slug
  ```const isSurteya = brand.slug === "surteya";```

### `src/modules/onboarding/components/SubdomainPreview.tsx` (1)
- L80 · hardcoded 'surteya' slug
  ```placeholder="surteya"```

### `src/modules/superadmin/components/TenantOnboardingWizard.tsx` (1)
- L207 · hardcoded 'surteya' slug
  ```placeholder="Surteya"```

### `src/modules/tenant/lib/subdomain.ts` (1)
- L12 · hardcoded 'surteya' slug
  ```*   surteya.sistecpos.com  → tenant slug 'surteya' (storefront del negocio)```

## MEDIUM (322)


### `src/modules/pos/components/TableOrderDrawer.tsx` (17)
- L47 · supabase.from() without scoped wrapper (review)
  ```supabase.from("table_order_items").select("id,product_name,quantity,unit_price,total,status,notes")```
- L49 · supabase.from() without scoped wrapper (review)
  ```supabase.from("dining_tables").select("label").eq("id", tableId).single(),```
- L50 · supabase.from() without scoped wrapper (review)
  ```supabase.from("kitchen_stations").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),```
- L61 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("products").select("id,name,price").eq("is_active", true).order("name").limit(120);```
- L78 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("table_order_items").select("total").eq("table_order_id", orderId);```
- L80 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("table_orders").update({ subtotal, total: subtotal }).eq("id", orderId);```
- L86 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("table_order_items").insert({```
- L86 · missing organization_id on .insert()
  ```const { error } = await supabase.from("table_order_items").insert({```
- L104 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("table_order_items").delete().eq("id", item.id);```
- L106 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("table_order_items").update({ quantity: q, total: q * item.unit_price }).eq("id", item.id);```
- _… +7 más_

### `src/modules/admin-cms/components/ContentTab.tsx` (14)
- L34 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("banners").select("*").order("sort_order");```
- L53 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("banners").update(payload).eq("id", editing);```
- L56 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("banners").insert(payload);```
- L67 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("banners").delete().eq("id", id);```
- L73 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("banners").update({ is_active: !current }).eq("id", id);```
- L131 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("testimonials").select("*").order("sort_order");```
- L142 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("testimonials").update(payload).eq("id", editing);```
- L145 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("testimonials").insert(payload);```
- L156 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("testimonials").delete().eq("id", id);```
- L201 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("gallery").select("*").order("sort_order");```
- _… +4 más_

### `supabase/functions/send-transactional-email/index.ts` (14)
- L151 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L151 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L184 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L184 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L217 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L217 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L246 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L246 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L268 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L268 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- _… +4 más_

### `src/modules/admin-cms/pages/Compras.tsx` (13)
- L68 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("suppliers").select("*").eq("organization_id", orgId).order("name");```
- L75 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("suppliers").insert({ ...form, organization_id: orgId });```
- L84 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("suppliers").update({ is_active: !s.is_active }).eq("id", s.id);```
- L147 · supabase.from() without scoped wrapper (review)
  ```queryFn: async () => (await supabase.from("suppliers").select("id,name").eq("organization_id", orgId).eq("is_active", true).order("name")).d```
- L154 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("supplier_products")```
- L166 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("products").select("id,name,sku").ilike("name", \`%${search}%\`).limit(10);```
- L174 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("supplier_products").insert({ ...form, organization_id: orgId, supplier_id: supplierId });```
- L183 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("supplier_products").update({ is_preferred: !r.is_preferred }).eq("id", r.id);```
- L189 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("supplier_products").delete().eq("id", id);```
- L269 · supabase.from() without scoped wrapper (review)
  ```queryFn: async () => (await supabase.from("purchase_orders")```
- _… +3 más_

### `src/modules/admin-cms/components/AgendaTab.tsx` (12)
- L51 · supabase.from() without scoped wrapper (review)
  ```supabase.from("appointments")```
- L57 · supabase.from() without scoped wrapper (review)
  ```supabase.from("service_catalog").select("*").eq("organization_id", orgId).order("sort_order"),```
- L58 · supabase.from() without scoped wrapper (review)
  ```supabase.from("service_resources").select("*").eq("organization_id", orgId).order("name"),```
- L111 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("service_catalog").delete().eq("id", s.id);```
- L133 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("service_resources").delete().eq("id", r.id);```
- L164 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("appointments").update({ status: v }).eq("id", appt.id);```
- L193 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("appointments").insert({```
- L193 · missing organization_id on .insert()
  ```const { error } = await supabase.from("appointments").insert({```
- L246 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("service_catalog").insert({```
- L246 · missing organization_id on .insert()
  ```const { error } = await supabase.from("service_catalog").insert({```
- _… +2 más_

### `src/modules/admin-cms/components/ProductsTab.tsx` (12)
- L63 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("product_media").insert({```
- L63 · missing organization_id on .insert()
  ```await supabase.from("product_media").insert({```
- L78 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("product_media").delete().eq("id", mediaId);```
- L92 · supabase.from() without scoped wrapper (review)
  ```supabase.from("product_media").update({ sort_order: swap.sort_order }).eq("id", current.id),```
- L93 · supabase.from() without scoped wrapper (review)
  ```supabase.from("product_media").update({ sort_order: current.sort_order }).eq("id", swap.id),```
- L146 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("featured_sections").select("*").order("sort_order");```
- L350 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("products").update(payload).eq("id", editing);```
- L354 · supabase.from() without scoped wrapper (review)
  ```const { data: newProduct, error } = await supabase.from("products").insert(payload).select("id, name, price, base_unit").single();```
- L368 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("products").delete().eq("id", id);```
- L375 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("products").update({ is_active: !currentActive }).eq("id", id);```
- _… +2 más_

### `src/modules/admin-cms/components/LandingPagesTab.tsx` (11)
- L202 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("landing_page_products").delete().eq("landing_page_id", pageId);```
- L210 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("landing_page_products").insert(rows);```
- L218 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("landing_pages").select("*").order("sort_order");```
- L251 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("landing_pages").update(payload).eq("id", editing.id);```
- L254 · supabase.from() without scoped wrapper (review)
  ```const { data: inserted, error } = await supabase.from("landing_pages").insert(payload).select("id").single();```
- L274 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("landing_pages").delete().eq("id", id);```
- L283 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("landing_pages").update({ is_active: !page.is_active }).eq("id", page.id);```
- L292 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("landing_pages").insert({ ...rest, slug: newSlug, title: \`${rest.title} (Copia)\` });```
- L292 · missing organization_id on .insert()
  ```const { error } = await supabase.from("landing_pages").insert({ ...rest, slug: newSlug, title: \`${rest.title} (Copia)\` });```
- L457 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("landing_pages").update(payload).eq("id", existing.id);```
- _… +1 más_

### `src/modules/admin-cms/components/ModifiersTab.tsx` (9)
- L64 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("products").select("id, name, price, stock, image_url, base_unit").order("name");```
- L145 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_groups").update(payload).eq("id", editingGroup);```
- L149 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_groups").insert(payload);```
- L162 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_groups").delete().eq("id", id);```
- L170 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_groups").update({ is_active: !current }).eq("id", id);```
- L207 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_options").update(payload).eq("id", editingOption);```
- L211 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_options").insert(payload);```
- L224 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_options").delete().eq("id", id);```
- L231 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("modifier_options").update({ is_active: !current }).eq("id", id);```

### `src/pages/GerenteIA.tsx` (8)
- L47 · supabase.from() without scoped wrapper (review)
  ```supabase.from("ai_insights").select("*").eq("organization_id", currentOrg.id)```
- L49 · supabase.from() without scoped wrapper (review)
  ```supabase.from("invoice_scans").select("*").eq("organization_id", currentOrg.id)```
- L51 · supabase.from() without scoped wrapper (review)
  ```supabase.from("warehouses").select("id,name").eq("organization_id", currentOrg.id).eq("is_active", true),```
- L72 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("ai_insights").update({ status }).eq("id", id);```
- L111 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("invoice_scan_items").select("*").eq("scan_id", s.id).order("line_no");```
- L116 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("invoice_scan_items").update({ matched_product_id: productId }).eq("id", itemId);```
- L134 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("invoice_scans").delete().eq("id", s.id);```
- L257 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("products").select("id,name,brand").ilike("name", \`%${q}%\`).limit(8);```

### `supabase/functions/process-email-queue/index.ts` (8)
- L63 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L63 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L274 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L274 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L301 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L301 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L338 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L338 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```

### `src/modules/admin-cms/components/PresentationsTab.tsx` (7)
- L25 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("products").select("id, name, price, stock, base_unit").order("name");```
- L99 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("product_presentations").update(payload).eq("id", editing);```
- L103 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("product_presentations").insert(payload);```
- L117 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("product_presentations").delete().eq("id", id);```
- L125 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("product_presentations").update({ is_active: !current }).eq("id", id);```
- L184 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("product_presentations").update(payload).eq("id", row.id);```
- L187 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("product_presentations").insert(payload);```

### `src/modules/pos/pages/Mesas.tsx` (7)
- L47 · supabase.from() without scoped wrapper (review)
  ```supabase.from("dining_areas").select("id,name,color").eq("organization_id", orgId).eq("is_active", true).order("sort_order"),```
- L48 · supabase.from() without scoped wrapper (review)
  ```supabase.from("dining_tables").select("id,label,capacity,pos_x,pos_y,width,height,shape,status,dining_area_id")```
- L50 · supabase.from() without scoped wrapper (review)
  ```supabase.from("table_orders").select("id,dining_table_id,total,opened_at")```
- L104 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("table_orders").insert({```
- L104 · missing organization_id on .insert()
  ```const { data, error } = await supabase.from("table_orders").insert({```
- L106 · supabase.from() without scoped wrapper (review)
  ```location_id: (await supabase.from("dining_tables").select("location_id").eq("id", t.id).single()).data?.location_id,```
- L113 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("dining_tables").update({ status: "occupied" }).eq("id", t.id);```

### `supabase/functions/invoice-ocr/index.ts` (7)
- L118 · supabase.from() without scoped wrapper (review)
  ```const { data: sup } = await supabase.from("suppliers").select("id")```
- L123 · supabase.from() without scoped wrapper (review)
  ```const { data: scan, error } = await supabase.from("invoice_scans").insert({```
- L123 · missing organization_id on .insert()
  ```const { data: scan, error } = await supabase.from("invoice_scans").insert({```
- L155 · supabase.from() without scoped wrapper (review)
  ```const { data: sp } = await supabase.from("supplier_products").select("product_id")```
- L160 · supabase.from() without scoped wrapper (review)
  ```const { data: p } = await supabase.from("products").select("id").eq("gtin", it.gtin).maybeSingle();```
- L164 · supabase.from() without scoped wrapper (review)
  ```const { data: p } = await supabase.from("products").select("id")```
- L171 · supabase.from() without scoped wrapper (review)
  ```if (items.length) await supabase.from("invoice_scan_items").insert(items);```

### `src/modules/admin-cms/components/ShippingTab.tsx` (6)
- L14 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("municipality_settings").select("city").eq("is_active", true).order("city");```
- L29 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("shipping_zones").select("*").order("city").order("neighborhood");```
- L73 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("shipping_zones").update(payload).eq("id", editing);```
- L77 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("shipping_zones").insert(payload);```
- L92 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("shipping_zones").delete().eq("id", id);```
- L124 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("shipping_zones").insert(rows);```

### `src/modules/admin-cms/components/UsersTab.tsx` (6)
- L53 · supabase.from() without scoped wrapper (review)
  ```const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");```
- L68 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("user_roles").update({ role: value as AppRole }).eq("id", userRecord.role_id);```
- L71 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: value as AppRole }]);```
- L76 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("profiles").update({ business_type: value as BusinessType }).eq("user_id", userId);```
- L102 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("profiles").update({```
- L139 · supabase.from() without scoped wrapper (review)
  ```const { error: roleError } = await supabase.from("user_roles").insert([{ user_id: newUserId, role: createForm.role }]);```

### `src/modules/clientes/pages/Onboarding.tsx` (6)
- L82 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("organizations").update({ name: companyName }).eq("id", currentOrg.id);```
- L85 · supabase.from() without scoped wrapper (review)
  ```const { data: existing } = await supabase.from("locations").select("id").eq("organization_id", currentOrg.id).limit(1).maybeSingle();```
- L87 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("locations").insert({ organization_id: currentOrg.id, name: locationName, city, is_active: true });```
- L95 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("organization_modules").upsert(```
- L103 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("onboarding_progress").upsert(```
- L112 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("onboarding_progress").upsert(```

### `src/modules/offline/lib/outbox.ts` (6)
- L115 · missing organization_id on .insert()
  ```.insert({ ...payload.header, client_uuid: item.client_uuid })```
- L123 · supabase.from() without scoped wrapper (review)
  ```const { error: e2 } = await supabase.from("pos_order_items").insert(lines);```
- L128 · supabase.from() without scoped wrapper (review)
  ```const { error: e3 } = await supabase.from("pos_payments").insert(pays);```
- L135 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("pos_payments").insert(payload);```
- L145 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("pos_quotes").insert(payload);```
- L150 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("parked_tickets").insert(payload);```

### `src/modules/admin-cms/components/BrandsTab.tsx` (5)
- L33 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("brands").select("*").order("sort_order");```
- L94 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("brands").update(payload).eq("id", editing);```
- L98 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("brands").insert(payload);```
- L113 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("brands").delete().eq("id", id);```
- L128 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("brands").update({ is_active: !current }).eq("id", id);```

### `src/modules/admin-cms/components/FeaturedSectionsTab.tsx` (5)
- L62 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("products").select("id, name, tags, is_fresh, is_wholesale, original_price, price, categories(sl```
- L103 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("featured_sections").insert({```
- L103 · missing organization_id on .insert()
  ```const { error } = await supabase.from("featured_sections").insert({```
- L120 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("featured_sections").delete().eq("id", id);```
- L131 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("featured_sections").update({ is_active: !current }).eq("id", id);```

### `src/modules/admin-cms/components/HeroSlidesTab.tsx` (5)
- L31 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("hero_slides").select("*").order("sort_order");```
- L77 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("hero_slides").update(payload).eq("id", editing);```
- L80 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("hero_slides").insert(payload);```
- L96 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("hero_slides").delete().eq("id", id);```
- L108 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("hero_slides").update({ is_active: !current }).eq("id", id);```

### `src/modules/admin-cms/components/MunicipalitiesTab.tsx` (5)
- L33 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("municipality_settings").select("*").order("city");```
- L88 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("municipality_settings").update(payload).eq("id", editing);```
- L92 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("municipality_settings").insert(payload);```
- L107 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("municipality_settings").delete().eq("id", id);```
- L117 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("municipality_settings").update({ is_active: !current }).eq("id", id);```

### `src/modules/admin-cms/components/ScriptsTab.tsx` (5)
- L21 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("custom_scripts").select("*").order("sort_order");```
- L51 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("custom_scripts").update(payload).eq("id", editing);```
- L55 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("custom_scripts").insert(payload);```
- L69 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("custom_scripts").delete().eq("id", id);```
- L77 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("custom_scripts").update({ is_active: !current }).eq("id", id);```

### `supabase/functions/sync-products-to-wp/index.ts` (5)
- L69 · supabase.from() without scoped wrapper (review)
  ```const { data: m } = await supabase.from("organization_members").select("id")```
- L146 · missing organization_id on .insert()
  ```await sbAdmin.from("sync_outbox").insert({```
- L157 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("tenant_wp_config").update({ last_sync_at: new Date().toISOString() }).eq("site_id", site_id);```
- L158 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("tenant_sync_log").insert({```
- L158 · missing organization_id on .insert()
  ```await supabase.from("tenant_sync_log").insert({```

### `src/modules/admin-cms/components/CategoriesTab.tsx` (4)
- L65 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("categories").update(payload).eq("id", editing);```
- L69 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("categories").insert(payload);```
- L83 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("categories").delete().eq("id", id);```
- L93 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("categories").update({ is_active: !current }).eq("id", id);```

### `src/modules/admin-cms/components/CouponsTab.tsx` (4)
- L47 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });```
- L83 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("coupons").update(payload).eq("id", editing);```
- L87 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("coupons").insert(payload);```
- L101 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("coupons").delete().eq("id", id);```

### `src/modules/admin-cms/components/GoogleReviewsTab.tsx` (4)
- L40 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("google_reviews").update(payload).eq("id", editing.id);```
- L44 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("google_reviews").insert(payload);```
- L53 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("google_reviews").update({ is_active: active }).eq("id", id);```
- L60 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("google_reviews").delete().eq("id", id);```

### `src/modules/clientes/pages/Billing.tsx` (4)
- L23 · supabase.from() without scoped wrapper (review)
  ```const { data: s } = await supabase.from("subscriptions").select("*, saas_plans(*)").eq("organization_id", currentOrg.id).maybeSingle();```
- L25 · supabase.from() without scoped wrapper (review)
  ```const { data: inv } = await supabase.from("subscription_invoices").select("*").eq("organization_id", currentOrg.id).order("created_at", { as```
- L27 · supabase.from() without scoped wrapper (review)
  ```const { data: p } = await supabase.from("saas_plans").select("*").eq("is_public", true).order("sort_order");```
- L36 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("subscriptions").update({```

### `src/modules/pos/components/InvoiceActionsDialog.tsx` (4)
- L65 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("pos_quotes").insert({```
- L65 · missing organization_id on .insert()
  ```const { error } = await supabase.from("pos_quotes").insert({```
- L89 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("parked_tickets").insert({```
- L89 · missing organization_id on .insert()
  ```const { error } = await supabase.from("parked_tickets").insert({```

### `supabase/functions/auth-email-hook/index.ts` (4)
- L246 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L246 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```
- L272 · supabase.from() without scoped wrapper (review)
  ```await supabase.from('email_send_log').insert({```
- L272 · missing organization_id on .insert()
  ```await supabase.from('email_send_log').insert({```

### `supabase/functions/fetch-google-reviews/index.ts` (4)
- L83 · supabase.from() without scoped wrapper (review)
  ```const { error: insertError } = await supabase.from("google_reviews").insert({```
- L83 · missing organization_id on .insert()
  ```const { error: insertError } = await supabase.from("google_reviews").insert({```
- L98 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("app_settings").upsert(```
- L104 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("app_settings").upsert(```

### `supabase/functions/send-web-push/index.ts` (4)
- L149 · supabase.from() without scoped wrapper (review)
  ```let q = supabase.from("push_subscriptions").select("*").eq("is_active", true);```
- L181 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);```
- L195 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("push_broadcast_logs").insert({```
- L195 · missing organization_id on .insert()
  ```await supabase.from("push_broadcast_logs").insert({```

### `supabase/functions/sitemap/index.ts` (4)
- L222 · supabase.from() without scoped wrapper (review)
  ```supabase.from('products').select('slug, id, updated_at, image_url, name').eq('is_active', true).order('updated_at', { ascending: false }),```
- L223 · supabase.from() without scoped wrapper (review)
  ```supabase.from('categories').select('slug, name, updated_at, og_image_url').eq('is_active', true).order('sort_order'),```
- L224 · supabase.from() without scoped wrapper (review)
  ```supabase.from('brands').select('slug, name, logo_url, created_at').eq('is_active', true).order('sort_order'),```
- L225 · supabase.from() without scoped wrapper (review)
  ```supabase.from('landing_pages').select('slug, updated_at, meta_title, image_url').eq('is_active', true),```

### `supabase/functions/verify-tenant-domain/index.ts` (4)
- L25 · supabase.from() without scoped wrapper (review)
  ```const { data: d } = await supabase.from("tenant_domains").select("*").eq("id", domain_id).maybeSingle();```
- L42 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("tenant_domains").update({```
- L49 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("tenant_sync_log").insert({```
- L49 · missing organization_id on .insert()
  ```await supabase.from("tenant_sync_log").insert({```

### `supabase/functions/wp-revalidate-webhook/index.ts` (4)
- L132 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("tenant_sync_log").insert({```
- L132 · missing organization_id on .insert()
  ```await supabase.from("tenant_sync_log").insert({```
- L142 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("sync_outbox").insert({```
- L142 · missing organization_id on .insert()
  ```await supabase.from("sync_outbox").insert({```

### `src/modules/admin-cms/components/CustomerReviewsTab.tsx` (3)
- L24 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("customer_reviews").update({ is_approved: approved }).eq("id", id);```
- L31 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("customer_reviews").update({ is_active: active }).eq("id", id);```
- L37 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("customer_reviews").update({ admin_response: response }).eq("id", id);```

### `src/modules/admin-cms/components/SeoContentTab.tsx` (3)
- L67 · supabase.from() without scoped wrapper (review)
  ```? supabase.from("seo_content").update(payload).eq("id", editing.id)```
- L68 · supabase.from() without scoped wrapper (review)
  ```: supabase.from("seo_content").insert(payload);```
- L78 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("seo_content").delete().eq("id", id);```

### `src/modules/admin-cms/components/SeoTab.tsx` (3)
- L47 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("app_settings").update({ value: values[key] || "" }).eq("id", existing.id);```
- L49 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("app_settings").insert({ key, value: values[key] || "" });```
- L49 · missing organization_id on .insert()
  ```await supabase.from("app_settings").insert({ key, value: values[key] || "" });```

### `src/modules/admin-cms/components/SettingsTab.tsx` (3)
- L149 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("app_settings").update({ value }).eq("id", existing.id);```
- L152 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("app_settings").insert({ key, value });```
- L152 · missing organization_id on .insert()
  ```const { error } = await supabase.from("app_settings").insert({ key, value });```

### `src/modules/pos/components/CloseSessionDialog.tsx` (3)
- L54 · supabase.from() without scoped wrapper (review)
  ```supabase.from("pos_payments").select("method,amount").eq("cash_session_id", sessionId),```
- L55 · supabase.from() without scoped wrapper (review)
  ```supabase.from("pos_orders").select("id", { count: "exact", head: true }).eq("cash_session_id", sessionId).eq("status", "paid"),```
- L56 · supabase.from() without scoped wrapper (review)
  ```supabase.from("cash_denominations").select("id,value,kind").eq("currency", "COP").eq("is_active", true).order("value", { ascending: false })```

### `src/modules/pos/pages/KDS.tsx` (3)
- L51 · supabase.from() without scoped wrapper (review)
  ```supabase.from("kitchen_stations").select("id,name,color").eq("organization_id", orgId).eq("is_active", true).order("sort_order"),```
- L52 · supabase.from() without scoped wrapper (review)
  ```supabase.from("kds_tickets").select("id,kitchen_station_id,dining_table_label,items,status,sent_at,started_at,ready_at,notes")```
- L83 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("kds_tickets").update(patch).eq("id", t.id);```

### `src/modules/pos/pages/POS.tsx` (3)
- L44 · supabase.from() without scoped wrapper (review)
  ```supabase.from("locations").select("id,name").eq("organization_id", orgId).eq("is_active", true).order("name"),```
- L45 · supabase.from() without scoped wrapper (review)
  ```supabase.from("cash_registers").select("id,name,location_id").eq("organization_id", orgId).eq("is_active", true),```
- L46 · supabase.from() without scoped wrapper (review)
  ```supabase.from("cash_sessions").select("id,location_id,cash_register_id,opening_amount,opened_at,status")```

### `src/modules/printing/hooks/usePrintQueue.ts` (3)
- L47 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("print_jobs").update({ status: "printing", attempts: job.attempts + 1 }).eq("id", job.id);```
- L67 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("print_jobs").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", job.id);```
- L70 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("print_jobs").update({```

### `src/modules/storefront/pages/ProductoDetalle.tsx` (3)
- L55 · supabase.from() without scoped wrapper (review)
  ```let query = supabase.from("products").select("*, categories(name, slug)");```
- L69 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId!).order("sort_order");```
- L79 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("product_presentations").select("*").eq("product_id", productId!).eq("is_active", true).order("s```

### `supabase/functions/innapsis-emit/index.ts` (3)
- L156 · missing organization_id on .insert()
  ```const { data: inv, error: invErr } = await admin.from("electronic_invoices").insert({```
- L210 · missing organization_id on .insert()
  ```await admin.from("einvoice_events").insert({```
- L230 · missing organization_id on .insert()
  ```await admin.from("einvoice_events").insert({```

### `src/modules/admin-cms/components/FiscalSettingsTab.tsx` (2)
- L96 · supabase.from() without scoped wrapper (review)
  ```? await supabase.from("einvoice_configs").update(payload as any).eq("id", cfg.id)```
- L97 · supabase.from() without scoped wrapper (review)
  ```: await supabase.from("einvoice_configs").insert(payload as any);```

### `src/modules/admin-cms/components/InventoryTab.tsx` (2)
- L210 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("products").update(payload).eq("id", obj.id);```
- L214 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("products").insert(payload);```

### `src/modules/admin-cms/components/NotificationsTab.tsx` (2)
- L186 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("broadcast_logs").update({ status: "failed", errors: [{ phone: "system", error: "Cancelado por el admi```
- L193 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("notification_subscriptions").update({ is_active: !current }).eq("id", id);```

### `src/modules/admin-cms/components/OrganizationsTab.tsx` (2)
- L165 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("organizations").insert({```
- L165 · missing organization_id on .insert()
  ```const { error } = await supabase.from("organizations").insert({```

### `src/modules/admin-cms/pages/AdminDashboard.tsx` (2)
- L177 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("categories").select("*").order("sort_order");```
- L208 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("app_settings").select("*");```

### `src/modules/admin-cms/pages/Inventario.tsx` (2)
- L34 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("warehouses").select("*").eq("organization_id", currentOrg.id).eq("is_active", true).order("is_default"```
- L51 · supabase.from() without scoped wrapper (review)
  ```const { data: pdata } = await supabase.from("products").select("id, name, sku, image_url").in("id", productIds);```

### `src/modules/notifications/lib/pushClient.ts` (2)
- L60 · supabase.from() without scoped wrapper (review)
  ```const { error: insErr } = await supabase.from("push_subscriptions").upsert(```
- L80 · supabase.from() without scoped wrapper (review)
  ```await supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", sub.endpoint);```

### `src/modules/onboarding/components/OnboardingChecklist.tsx` (2)
- L53 · supabase.from() without scoped wrapper (review)
  ```supabase.from("licenses").select("status")```
- L56 · supabase.from() without scoped wrapper (review)
  ```supabase.from("tenant_domains").select("ssl_status")```

### `src/modules/storefront/components/AgentBar.tsx` (2)
- L37 · supabase.from() without scoped wrapper (review)
  ```let query = supabase.from("profiles").select("*");```
- L86 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("profiles").update(updates).eq("id", customer.profileId);```

### `src/modules/storefront/pages/Hub.tsx` (2)
- L39 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("brands").select("*").eq("is_active", true).order("sort_order");```
- L48 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("featured_sections").select("*").order("sort_order");```

### `supabase/functions/broadcast-whatsapp-ycloud/index.ts` (2)
- L115 · missing organization_id on .insert()
  ```.insert({```
- L197 · missing organization_id on .insert()
  ```.insert({ message: logMessage, segment, status: "running", total: targets.length, sent_by: sentBy })```

### `supabase/functions/license-purchase-webhook/index.ts` (2)
- L61 · missing organization_id on .insert()
  ```.insert({ slug: unique, name: business_name, business_type, tax_id: nit ?? null })```
- L90 · missing organization_id on .insert()
  ```await supa.from("org_signup_requests").insert({```

### `supabase/functions/log-login-attempt/index.ts` (2)
- L32 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("auth_login_events").insert({```
- L32 · missing organization_id on .insert()
  ```const { error } = await supabase.from("auth_login_events").insert({```

### `src/lib/errors.ts` (1)
- L96 · supabase.from() without scoped wrapper (review)
  ```*   const [data, err] = await safeAsync(supabase.from('x').select());```

### `src/modules/admin-cms/components/ModulesTab.tsx` (1)
- L30 · supabase.from() without scoped wrapper (review)
  ```supabase.from("modules").select("*").eq("is_active", true).order("sort_order"),```

### `src/modules/admin-cms/components/OrdersTab.tsx` (1)
- L48 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);```

### `src/modules/admin-cms/components/SyncMonitor.tsx` (1)
- L34 · supabase.from() without scoped wrapper (review)
  ```let q = supabase.from("sync_logs").select("*").order("last_run_at", { ascending: false }).limit(200);```

### `src/modules/admin-cms/pages/Facturacion.tsx` (1)
- L77 · supabase.from() without scoped wrapper (review)
  ```const { error } = await supabase.from("einvoice_configs").upsert(payload, {```

### `src/modules/auth/lib/loginTelemetry.ts` (1)
- L22 · missing organization_id on .insert()
  ```void supabase.from("auth_login_events").insert({```

### `src/modules/clientes/components/ClientTicketsTab.tsx` (1)
- L96 · missing organization_id on .insert()
  ```const { error } = await (supabase as any).from("client_tickets").insert({```

### `src/modules/clientes/components/TicketChatView.tsx` (1)
- L110 · missing organization_id on .insert()
  ```const { error } = await (supabase as any).from("ticket_messages").insert({```

### `src/modules/clientes/pages/Planes.tsx` (1)
- L31 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("saas_plans").select("*").eq("is_public", true).order("sort_order");```

### `src/modules/onboarding/components/SubdomainPreview.tsx` (1)
- L59 · supabase.from() without scoped wrapper (review)
  ```const { data } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();```

### `src/modules/pos/components/OpenSessionPanel.tsx` (1)
- L61 · missing organization_id on .insert()
  ```.insert({```

### `src/modules/printing/components/KitchenRoutingTab.tsx` (1)
- L61 · missing organization_id on .insert()
  ```const { error } = await (supabase as any).from("kitchen_stations").insert({```

### `src/modules/storefront/components/BannerCarousel.tsx` (1)
- L20 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("banners").select("*").eq("is_active", true).order("sort_order");```

### `src/modules/storefront/components/BrandsSection.tsx` (1)
- L13 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("brands").select("*").eq("is_active", true).order("sort_order");```

### `src/modules/storefront/components/ModifierPicker.tsx` (1)
- L68 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("products").select("id, name, stock, image_url").in("id", linkedIds);```

### `src/modules/storefront/components/TestimonialsSection.tsx` (1)
- L10 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("testimonials").select("*").eq("is_active", true).order("sort_order");```

### `src/modules/storefront/pages/Carrito.tsx` (1)
- L164 · supabase.from() without scoped wrapper (review)
  ```const { data, error } = await supabase.from("shipping_zones").select("*").eq("is_active", true).order("city").order("neighborhood");```

### `src/modules/superadmin/pages/Licencias.tsx` (1)
- L193 · missing organization_id on .insert()
  ```const { error } = await supabase.from("desktop_releases").insert({```

### `src/pages/AdminDiag.tsx` (1)
- L106 · supabase.from() without scoped wrapper (review)
  ```const { data: rolesData, error: rolesErr } = await supabase.from("user_roles").select("role, created_at").eq("user_id", uid);```

### `supabase/functions/_shared/auth-service.ts` (1)
- L35 · missing organization_id on .insert()
  ```await sb.from("auth_login_events").insert({```

### `supabase/functions/ai-manager/index.ts` (1)
- L136 · supabase.from() without scoped wrapper (review)
  ```if (rows.length) await supabase.from("ai_insights").insert(rows);```

### `supabase/functions/auth-totp-enroll/index.ts` (1)
- L23 · missing organization_id on .insert()
  ```const { error } = await sb.from("auth_factors").insert({```

### `supabase/functions/handle-email-suppression/index.ts` (1)
- L111 · missing organization_id on .insert()
  ```.insert({```

### `supabase/functions/innapsis-status/index.ts` (1)
- L88 · missing organization_id on .insert()
  ```await admin.from("einvoice_events").insert({```

### `supabase/functions/lead-capture/index.ts` (1)
- L44 · missing organization_id on .insert()
  ```.insert({```

### `supabase/functions/printer-event-log/index.ts` (1)
- L69 · missing organization_id on .insert()
  ```const { error } = await admin.from("health_events").insert({```

### `supabase/functions/send-whatsapp-order/index.ts` (1)
- L48 · missing organization_id on .insert()
  ```.insert({```

### `supabase/functions/sso-issue/index.ts` (1)
- L51 · missing organization_id on .insert()
  ```.insert({```

### `supabase/functions/tenant-create-with-owner/index.ts` (1)
- L102 · missing organization_id on .insert()
  ```.insert({ slug, name, business_type, tax_id, country: "CO", currency: "COP" })```

## LOW (3)


### `src/modules/pos/components/POSWorkspace.tsx` (1)
- L64 · TODO/FIXME tenant
  ```const TAX_RATE = 0; // TODO: leer de organizations.settings cuando se configure por org.```

### `src/pages/AuthStatus.tsx` (1)
- L69 · TODO/FIXME tenant
  ```return "✓ Todo en orden. Tenant detectado y profile vinculado correctamente.";```

### `supabase/functions/ai-manager/index.ts` (1)
- L43 · TODO/FIXME tenant
  ```// Datos contextuales — TODOS filtrados estrictamente por organization_id.```
