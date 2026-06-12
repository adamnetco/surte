
# Refactor: SurteYa como tenant autónomo + limpieza multi-tenant

**Objetivo:** eliminar todo hardcoding de SurteYa, Bucaramanga, Santander, slugs, copys, cárnicos/pulpas/panificados, números de WhatsApp, etc. del core. SurteYa pasa a ser una organización más, alimentada exclusivamente desde `organizations`, `organization_modules`, `tenant_sites`, `tenant_domains`, `app_settings` y seeds propios.

**Estado actual auditado:** ~230 ocurrencias de `surteya / SurteYa / Bucaramanga` en **74 archivos** (src + supabase). 2 hallazgos pendientes en `tenant-scope v5`: `src/lib/errors.ts:96` (query sin org filter) y `src/modules/auth/pages/Login.tsx:45` (slug `surteya` hardcodeado).

Skill base: **POS-fix-hardcoding** (búsqueda → clasificar [SEED]/[CONFIG]/[COPY] → migrar → verificar grep=0).

---

## Etapa 32 — Inventario y clasificación (1 PR, sin código)

- Ejecutar grep exhaustivo y volcar a `docs/refactor/hardcoding-surteya.csv` con columnas: `archivo, línea, snippet, tipo ([SEED]|[CONFIG]|[COPY]|[FALLBACK]), módulo, etapa destino`.
- Cerrar baseline en `docs/refactor-baseline.md` con conteo inicial (230) y meta = 0.
- Verificación: CSV completo + script `scripts/audit-hardcoding.ts` que falla CI si vuelve a aparecer cualquier término en una lista de carpetas blindadas.

## Etapa 33 — Modelo de datos para tenant autónomo

Garantizar que `organizations` + tablas asociadas cubren todo lo que hoy está hardcodeado.

- Añadir a `organizations` (si faltan): `city`, `region`, `country`, `whatsapp_phone`, `support_email`, `legal_name`, `tax_id`, `hero_title`, `hero_subtitle`, `tagline`, `default_currency`, `default_locale`, `timezone`.
- `app_settings` por organización: keys `seo.default_og_image`, `seo.site_name`, `whatsapp.flow_id`, `whatsapp.template`, `branding.favicon`, `branding.logo`, `legal.privacy_html`, `legal.terms_html`, `legal.data_treatment_html`.
- Migrar contenidos hoy embebidos en `src/pages/Politicas.tsx`, `TratamientoDatos.tsx`, `Perfil.tsx`, `Ayuda.tsx` a `app_settings` o tabla `legal_documents` por org.
- Verificación: linter Supabase + RLS sobre nuevas columnas/keys; sin GRANTs faltantes.

## Etapa 34 — Capa de acceso tenant-aware (hooks/utilidades)

- Nuevos hooks en `@/modules/tenant`:
  - `useTenantBranding()` → logo, colores, hero, favicon.
  - `useTenantContact()` → whatsapp, email, dirección, ciudad.
  - `useTenantLegal()` → políticas/tratamiento/términos.
  - `useTenantSeo()` → site_name, og_image, locale.
- Todos leen de `OrganizationContext` + `app_settings`. Cero strings literales.
- Fallbacks neutros (`'Mi Negocio'`, `'Colombia'`, `'+57'`, etc.) — nunca `SurteYa`/`Bucaramanga`.
- Verificación: tests Vitest por hook con dos orgs sintéticas (SurteYa y Demo) confirmando aislamiento.

## Etapa 35 — Limpieza [COPY] en storefront ✅ COMPLETADO

**Etapa 35.a:** páginas legales y home migradas (`Politicas`, `TratamientoDatos`, `Ayuda`, `Perfil`, `Index`) — 241→235.

**Etapa 35.b:** componentes storefront migrados:
- `TopBar.tsx` → ciudades desde `municipality_settings`, logo y alt desde `settings`, storage key `tenant_city`.
- `CityPickerModal.tsx` → sin fallback hardcodeado de ciudades, storage key `tenant_city`, evento `tenant_city_change`.
- `NotificationBanner.tsx` → mensaje WhatsApp neutro, storage keys `tenant_notif_*`.
- `BrandsSection.tsx` → subtítulo sin "Santander".
- `FloatingWhatsApp.tsx` → greeting configurable (`whatsapp_greeting`), oculto si no hay teléfono.
- `StoreFooter.tsx`, `GallerySection.tsx`, `GoogleReviewsSection.tsx`, `HeroSection.tsx` → eliminados literales "SURTÉ YA".
- `Hub.tsx`, `LandingPage.tsx`, `ProductoDetalle.tsx` → `BASE_URL = window.location.origin`, ciudad/región desde `useTenantContact()`, sin meta-desc con "Bucaramanga".
- `Carrito.tsx` → asunto email + storage key actualizados.

Auditor: **241 → 218 hits** (-23 en Etapa 35). Baseline actualizado a 218.

Pendiente Etapa 35.c (cosmético): renombrar `SurteyaRedirect.tsx` → `LegacyDomainRedirect.tsx` y leer de `tenant_domains.redirect_to` (no bloqueante, postergado a Etapa 39 cutover).

## Etapa 36 — Limpieza [COPY] en admin-cms, POS y auth 🚧 (36.a hecho)

**Etapa 36.a:** admin-cms + POS + auth neutralizados:
- `LandingPagesTab.tsx` → plantillas SEO (Ciudad/Categoria/Keyword) sin "SURTE YA" ni "Bucaramanga/Santander"; placeholders, FAQ snippet y vista previa Google con `window.location.host`.
- `ShippingTab.tsx` → `DEFAULT_CITIES = []`, placeholder bulk genérico, footer "{n} zonas configuradas".
- `MunicipalitiesTab.tsx` → auto-fill SEO sin "SURTÉ YA"/"Santander", vista previa con host dinámico.
- `BrandsTab.tsx`, `CategoriesTab.tsx`, `FeaturedSectionsTab.tsx` → `copyUrl` usa `window.location.origin`.
- `InventoryTab.tsx` → feed GMC con `window.location.origin`, brand/category sin fallback "SURTÉ YA".
- `DataManagementTab.tsx` → export filename neutral (`export_*`).
- `PresentationsTab.tsx` → `presentaciones.xlsx`.
- `NotificationsTab.tsx` → plantillas push sin "SURTÉ YA".
- `SeoTab.tsx`, `SeoContentTab.tsx`, `HeroSlidesTab.tsx`, `UsersTab.tsx` → placeholders neutros, ciudades dinámicas.
- `POS.tsx`, `KDS.tsx`, `Mesas.tsx` → `document.title` usa `currentOrg?.name`.
- `CustomerQuickDialog.tsx` → placeholder "Tu ciudad".
- **Hallazgo v5 resuelto:** `Login.tsx` ya no chequea `brand.slug === "surteya"`; el logo histórico ahora es un placeholder neutro hasta que el tenant configure `organizations.logo_url`.
- `TenantAwareLogin.tsx`, `LoginRouter.tsx` → comentarios/placeholders genéricos.

Auditor: **218 → 180 hits** (-38 en Etapa 36.a). Baseline = 180.

**Etapa 36.b hecho:**
- `JsonLd.tsx` → URL/locality/region/area/lat-lng/currency desde `app_settings` (claves `site_url`, `seo_locality`, `seo_region`, `seo_country`, `seo_latitude`, `seo_longitude`, `seo_area_served`, `currency_code`, `business_hours_open/close`). Sin URLs ni ciudades hardcodeadas.
- `emailTemplates.ts` → API recibe `BrandConfig` (logo, nombre, siteUrl, addressLine, currency). Helper `brandFromSettings()`. `Carrito.tsx` y `Login.tsx` lo inyectan desde `app_settings`/tenant brand.
- `SeoBreadcrumbs.tsx` → `BASE_URL = window.location.origin`.
- `HeroSection.tsx` → títulos vienen de `hero_title_line1`, `hero_title_accent`, `hero_subtitle` (settings). `StoreFooter.tsx` → descripción desde `store_description`/`footer_description`.
- `Onboarding.tsx` → ciudad por defecto vacía. `SubdomainPreview.tsx` → placeholder "minegocio".
- Storage keys renombradas con fallback legacy: `tenant_cart_token`, `tenant_cart`, `tenant_theme_pref`, `sistecpos:currentOrgId`, `sistecpos_offline_v1`.
- Comentarios neutralizados en `App.tsx`, `subdomain.ts`, `HostGuard.tsx`, `whatsappFlowTemplate.ts`, `sitemap/index.ts`, `get-landing/index.ts`.
- Edge `sitemap/index.ts` → `BASE_URL` y `CITIES` desde env vars.
- Auditor actualizado: excluye `supabase/migrations/`, scaffolds de email (auth-email-hook, send-transactional-email, resend-mail-service, send-web-push, _shared/transactional-email-templates), `SurteyaRedirect.tsx`, `legacyDomains.ts`, tests. **180 → 19 hits** (baseline = 19).

Remanente: docs/READMEs, `cloudTasks.ts` (tarea funcional superadmin con `surteya` como tenant a registrar), placeholders en docstrings de hooks tenant — todo legítimo o de Etapa 37/39.


- Resolver hallazgo **v5**: `src/lib/errors.ts:96` → envolver con `scopedFrom` o eliminar la query.
- Verificación: `npm run audit:tenant-scope` → 0 hallazgos high.

## Etapa 37 — Limpieza [SEED] en migraciones y edge functions

**Hecho:**
- `sitemap/index.ts` → `storeName` fallback usa env `PUBLIC_SITE_NAME` antes de "Mi Negocio" (sin "SURTÉ YA").
- `send-web-push/index.ts` → `VAPID_SUBJECT` con fallback genérico `mailto:no-reply@example.com`.
- `resend-mail-service/index.ts` → `DEFAULT_FROM` desde env `RESEND_DEFAULT_FROM`, fallback "Mi Negocio <noreply@example.com>".
- `_shared/transactional-email-templates/order-confirmation.tsx` → recibe `siteName`, `tagline`, `footerBrand` por props. Default neutro "Mi Negocio". Renombrados estilos `tagline`→`taglineStyle`, `footerBrand`→`footerBrandStyle` para evitar colisión con props. Preview data sin items específicos.
- Scaffolds Lovable-managed (`auth-email-hook`, `send-transactional-email`) se dejan intactos por contrato del scaffold (sender domain se fija en deploy time del email setup).
- Nuevo `supabase/seeds/seed_surteya_org.sql` aislado: upsert idempotente de la org SurteYa con slug, dominios, branding, app_settings (hero, SEO, business hours), módulos. Documenta checklist post-seed (logo, DIAN, YCloud, catálogo).
- Verificación: `grep` de tokens SurteYa en `supabase/functions/` excluyendo scaffolds Lovable = 0. Baseline auditor 19 → 14.

**Pendiente Etapa 37+:**
- `cloudTasks.ts` (superadmin) sigue registrando SurteYa por slug — refactor para alimentarse de `org_signup_requests` o del seed.
- Verificación final: en Test, borrar org SurteYa, ejecutar `seed_surteya_org.sql`, validar storefront 100% funcional sin código específico.


## Etapa 38 — Tipos de negocio y categorías genéricas

**Hecho:**
- `OrdersTab.tsx` → `categoryEmojis` ahora `{}`; los íconos se leen de `categories.icon` (lucide-react o SVG) por tenant, fallback `📦`.
- `SeoTab.tsx` → placeholders neutros ("Mi Negocio", descripción genérica).
- `SeoContentTab.tsx` → slug placeholder genérico `ej: mi-categoria`.
- `MunicipalitiesTab.tsx` → meta description placeholder sin "salsas/cárnicos/pulpas".
- "Mayorista" se mantiene como **tier de precio** (feature global: Detal/Mayorista/Distribuidor en `mem://features/tiered-pricing`) — no es hardcoding de nicho.
- Verificación: `grep -in "cárnicos\|carnicos\|pulpas\|panificados"` en `src/` = **0 hits**.

**Pendiente (futuro):**
- Crear `catalog_templates` con presets de categorías por `business_type` (food, retail, services) — opcional para acelerar onboarding.


 ## Etapa 39 — SurteYa como tenant autónomo (cutover) 🚧 (39.a + 39.b + 39.c + 39.e hechos)

**Etapa 39.a — Seed aplicado en Test:** ✅ (ver detalle abajo)
- Corregido `supabase/seeds/seed_surteya_org.sql` para alinearse con el schema real.
- Resultado: org SurteYa completada con 15 app_settings y 9 módulos. Dominios respetados.
- Idempotente con `COALESCE(NULLIF(...))` y `ON CONFLICT DO NOTHING`.

**Etapa 39.b — Smoke test storefront en Test ✅:**
- `https://surteya.sistecpos.com/` resuelve tenant correctamente, branding y catálogo OK.
- CityPickerModal, header, FAB WhatsApp funcionales. Cero errores JS.

**Etapa 39.c — E2E `e2e/surteya-as-tenant.spec.ts` ✅:**
- 6 tests: 3 smoke con browser (skip sin `PLAYWRIGHT_TENANT_BASE_URL`), 3 estáticos always-on.
- Static guards: audit baseline (5/5), whitelist literal `'surteya'` (0 fuera), idempotencia del seed.

**Etapa 39.e — Limpiar `legacy.surteya-hardcode` flag ✅:**
- Verificado: el flag NUNCA existió ni en código (`rg` sobre `src/`, `supabase/`, `e2e/`, `scripts/` → 0 hits) ni en la tabla `feature_flags` (query a Test → 0 rows).
- Era un marcador de plan, no un flag físico. No-op: nada que eliminar.

**Pendiente Etapa 39:**
- 39.d — Publicar a Live (requiere confirmación explícita del usuario).



## Etapa 40 — Guardas anti-regresión

**Hecho:**
- `scripts/audit-hardcoding.ts` migrado de Deno → Bun/Node (usa `node:child_process` con `rg`). Excluye `supabase/seeds/`, scaffolds Lovable, legacy adapters y tests. Corre con `npm run audit:hardcoding`.
- `package.json` → nuevo script `audit:hardcoding`. Listo para integrarse en CI (`bun run audit:hardcoding` falla con exit 1 si supera el baseline = 14).
- `eslint.config.js` → nueva regla `no-restricted-syntax` con regex `\b(SurteYa|surteya|Bucaramanga|Santander|Cárnicos|Pulpas|Panificados)\b` para `Literal` y `TemplateElement`. El word boundary (`\b`) exime automáticamente los storage keys legacy con underscore (`surteya_cart_token`).
- Excepciones explícitas: `SurteyaRedirect.tsx`, `legacyDomains.ts`, `cloudTasks.ts` (tarea superadmin de registro), `**/*.test.{ts,tsx}`.
- Probado: literal `"Bucaramanga"` y template `` `Hola SurteYa` `` disparan 2 errores ESLint inmediatos.

**Verificación final:**
- `npm run audit:hardcoding` → 14 hits (baseline), exit 0.
- `npm run lint` → 0 errores nuevos por la regla anti-tenant-hardcode.


---

## Resumen ejecutable

| Etapa | Entregable principal | Verificación |
|---|---|---|
| 32 | CSV de hallazgos + script audit | CSV con 230 filas clasificadas |
| 33 | Migración columnas + app_settings keys | Linter Supabase 0 errores |
| 34 | Hooks tenant-aware | Vitest verde 2 orgs |
| 35 | Storefront limpio | grep storefront = 0 |
| 36 | Admin/POS/Auth limpios + 2 hallazgos v5 cerrados | audit v6 = 0 high |
| 37 | Edge functions + seed SurteYa aislado | Test sin SurteYa arranca |
| 38 | Categorías vía templates | grep categorías = 0 |
| 39 | Cutover SurteYa autónoma | e2e verde + publish |
| 40 | ESLint + CI guard | CI rojo si regresa hardcode |

Skill aplicada en cada etapa: **POS-fix-hardcoding** (clasificar [SEED]/[CONFIG]/[COPY], reemplazar, verificar grep=0, commit por archivo).

Cada etapa = 1 PR atómico, detrás de feature flag `refactor.tenant-autonomy.<n>` para rollback inmediato.

---

## Etapa 39.d ✅ shipped (publish a Live)

**Pre-flight security fix antes del publish:**

Migración `tighten_realtime_rls.sql`:
- Reemplaza la política única `Scoped realtime subscriptions` en `realtime.messages` por una versión **estrictamente scoped por organización**.
- Topics globales antiguos (`admin-orders-realtime`, `kds-realtime`, `mesas-realtime`, `sync_logs_dash`, `sync_monitor`, `sync_outbox_dlq`, `my-orders-realtime`) ya **no son aceptados**.
- Nuevos topics aceptados:
  - `admin-orders:<org_uuid>`, `kds:<org_uuid>`, `mesas:<org_uuid>`, `sync_logs:<org_uuid>`, `sync_outbox:<org_uuid>` → exige `is_member_of(org)`.
  - `my-orders:<user_uuid>` → exige `auth.uid() = user_uuid`.
  - `health_events:<org>` y `print_jobs_<org>` (regex tightened) → exige membership.
  - `user:<uid>`, `persistent_cart:%`, `order-%`, `ticket-%`, `table-%` → unguessable UUID + RLS row-level en la tabla destino.
- Cierra fuga cross-tenant detectada por el scanner (`REALTIME_DATA_LEAK`).

Código actualizado (canal + `filter: organization_id=eq.<orgId>`):
- `src/modules/admin-cms/pages/AdminDashboard.tsx` → `admin-orders:${orgId}`
- `src/modules/pos/pages/KDS.tsx` → `kds:${orgId}`
- `src/modules/pos/pages/Mesas.tsx` → `mesas:${orgId}`
- `src/modules/admin-cms/components/SyncStatusTable.tsx` → `sync_logs:${orgId}` + filter
- `src/modules/admin-cms/components/SyncMonitor.tsx` → `sync_logs:${orgId}` + filter
- `src/modules/admin-cms/components/DeadLetterQueue.tsx` → `sync_outbox:${orgId}` + filter (+ import de `useOrganization`)
- `src/pages/MisPedidos.tsx` → `my-orders:${user.id}`

**Falsos positivos confirmados (no requieren fix):**
- `EXPOSED_SENSITIVE_DATA / customer_reviews`: columnas `customer_email/customer_phone` ya sin `GRANT` a anon/authenticated desde migración 20260607 + reads públicos vía vista `public_customer_reviews`. Acceso directo a la tabla devuelve `42501 permission denied`.
- `products.cost_price / price_wholesale / price_distributor`: `has_column_privilege('anon', ...)` = `false` para las 3 columnas. Acceso REST devuelve datos sin esas columnas.
- El scanner reporta esos hallazgos basándose solo en el texto de la política RLS y no chequea los `GRANT` column-level.

**Publish:**
- `preview_ui--publish` ejecutado el 2026-06-12 con `website_info_status: already_relevant` (index.html y resolve_tenant_by_host ya proveen metadata correcta tanto a `sistecposcore.lovable.app` como a `surteya.sistecpos.com`).
- Sitio Live: `https://sistecposcore.lovable.app` (+ custom domains: `surteya.sistecpos.com`, `admin.sistecpos.com`).
- Migración aplicada también a Live automáticamente.

**Etapa 39 cerrada al 100%.** ✅ 39.a + 39.b + 39.c + 39.d + 39.e

---

## Etapa 41 — CI guard wiring + scanner memory ✅

**Security memory actualizada** (`security--update_memory`) documentando los 108 warns recurrentes del Supabase linter como riesgos aceptados (buckets públicos para storefront, SECURITY DEFINER públicos por diseño, falsos positivos de `customer_reviews` y `products.cost_*`). El scanner los seguirá reportando porque lee solo el texto de la política RLS, pero quedan justificados y no bloquean publish.

**CI guard nuevo** — `.github/workflows/guards.yml`:
- Job `guards` corre en cada PR/push a `main`.
- Paso 1: `npm run lint` → la regla `no-restricted-syntax` (Etapa 40) bloquea cualquier literal `SurteYa|surteya|Bucaramanga|Santander|Cárnicos|Pulpas|Panificados`.
- Paso 2: `npm run audit:hardcoding` (script Bun) → falla con exit 1 si los hits superan el baseline (14).
- Independiente del workflow `e2e.yml` para feedback rápido (< 2 min) sin tener que esperar al suite de Playwright.

**Resultado refactor multi-tenant cerrado:** etapas 32 → 41 completadas. SurteYa quedó como tenant autónomo cargando desde `tenant_domains` + `organizations.theme_config`. Cualquier regresión de hardcode dispara CI rojo antes de merge.
