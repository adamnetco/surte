
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

## Etapa 36 — Limpieza [COPY] en admin-cms, POS y auth

Archivos blanco: `src/modules/admin-cms/components/*Tab.tsx`, `src/modules/pos/pages/*`, `src/modules/auth/pages/Login.tsx`, `LoginRouter.tsx`, `TenantAwareLogin.tsx`, `Onboarding.tsx`, `CustomerQuickDialog.tsx`, `Mesas.tsx`, `KDS.tsx`, `POS.tsx`.

- Resolver hallazgo **v5**: eliminar `const isSurteya = brand.slug === "surteya"` en `Login.tsx:45` → usar `useTenantBranding().isLegacyStorefront` o feature flag por org.
- Resolver hallazgo **v5**: `src/lib/errors.ts:96` → envolver con `scopedFrom` o eliminar la query.
- Verificación: `npm run audit:tenant-scope` → 0 hallazgos high.

## Etapa 37 — Limpieza [SEED] en migraciones y edge functions

- Edge functions con literales: `sitemap`, `send-web-push`, `send-transactional-email`, `auth-email-hook`, `resend-mail-service`, `get-landing`, `_shared/transactional-email-templates/order-confirmation.tsx`.
  - Aceptar `organization_id` o `host` y resolver tenant vía `resolve-tenant`.
  - Plantillas leen branding/contact desde `organizations` + `app_settings`.
- Migraciones históricas con seed de SurteYa: **no** se modifican (regla de POS-primer). En su lugar, nueva migración `seed_surteya_org.sql` que upserta SurteYa como organización con su slug, dominios, módulos, contenidos legales, hero, branding, números, ciudad. Cualquier migración futura usa orgs genéricas.
- Verificación: en Test, borrar la org SurteYa y comprobar que el sistema arranca limpio con orgs demo.

## Etapa 38 — Tipos de negocio y categorías genéricas

- Quitar referencias hardcodeadas a Cárnicos / Pulpas / Panificados / Mayorista del core (UI + lógica).
- Migrar a `catalog_templates` + `catalog_template_items` por `business_type`. SurteYa aplica template `food-mayorista` al provisionar.
- Verificación: `grep -i "cárnicos\|pulpas\|panificados\|mayorista"` en `src/` = 0 fuera de templates/seeds.

## Etapa 39 — SurteYa como tenant autónomo (cutover)

- Ejecutar `seed_surteya_org.sql` en Test → validar storefront `surteya.sistecpos.com` 100% funcional sin código específico.
- E2E nuevo `e2e/surteya-as-tenant.spec.ts`: storefront, login, checkout WhatsApp, admin, POS — todo pasa sin referencias al slug en código.
- Toggle de feature flag `legacy.surteya-hardcode` que ya no hace nada → eliminar.
- Publicar a Live.

## Etapa 40 — Guardas anti-regresión

- ESLint rule custom `no-tenant-hardcode` que prohíbe literales: `surteya`, `SurteYa`, `Bucaramanga`, `Santander`, números `+573…` específicos, en `src/` (excepto `src/modules/tenant/lib/legacyDomains.ts` y tests).
- CI step: `scripts/audit-hardcoding.ts` falla el build si grep > 0.
- Añadir a `mem://core` la regla: "Nada específico de un tenant vive en código del core."

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
