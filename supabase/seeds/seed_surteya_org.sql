-- ============================================================================
-- seed_surteya_org.sql — Tenant-specific seed for SurteYa
-- ============================================================================
--
-- IMPORTANT
-- This script is NOT a migration. It is an idempotent seed that provisions
-- the SurteYa organization (slug, domains, branding, contact, modules) as a
-- regular tenant on top of a generic core. The core code/migrations MUST NOT
-- contain any reference to SurteYa.
--
-- Run manually in the target environment (Test / Live) when (re)provisioning
-- the SurteYa tenant, or invoke from `supabase/functions/reseed-demo` as part
-- of the demo bootstrap.
--
-- Pre-requisites:
--   * `organizations`, `tenant_domains`, `organization_modules`, `app_settings`
--     tables and their RLS policies exist (Etapas 1-36).
--   * The provisioning superadmin has service_role (run as service_role).
-- ============================================================================

BEGIN;

-- 1) Organization ------------------------------------------------------------
INSERT INTO public.organizations (
  slug, name, legal_name, city, country, currency_code, timezone,
  logo_url, primary_color, secondary_color, accent_color,
  contact_email, contact_phone, whatsapp_phone, is_active
) VALUES (
  'surteya',
  'SURTÉ YA',
  'Conjuguémonos Grupo Empresarial S.A.S.',
  'Bucaramanga',
  'CO',
  'COP',
  'America/Bogota',
  NULL,           -- set via admin after upload
  '#0C4B83',
  '#76B833',
  '#F37021',
  'hola@surteya.com',
  '+573001234567', -- replace with real number on first run
  '+573001234567',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  accent_color = EXCLUDED.accent_color,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  whatsapp_phone = EXCLUDED.whatsapp_phone,
  is_active = true,
  updated_at = now();

-- 2) Domains -----------------------------------------------------------------
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya')
INSERT INTO public.tenant_domains (organization_id, hostname, is_primary, is_verified, status)
SELECT org.id, d.hostname, d.is_primary, true, 'active'
FROM org, (VALUES
  ('surteya.sistecpos.com', true),
  ('www.surteya.sistecpos.com', false),
  ('surte.ya', false),
  ('www.surte.ya', false)
) AS d(hostname, is_primary)
ON CONFLICT (hostname) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  is_primary = EXCLUDED.is_primary,
  status = 'active',
  is_verified = true;

-- 3) Organization-scoped app_settings (branding, SEO, hero, business hours) --
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya')
INSERT INTO public.app_settings (organization_id, key, value)
SELECT org.id, kv.key, kv.value
FROM org, (VALUES
  ('store_name',            'SURTÉ YA'),
  ('store_description',     'Soluciones alimenticias para hogares y negocios en Bucaramanga.'),
  ('site_url',              'https://surteya.sistecpos.com'),
  ('currency_code',         'COP'),
  ('seo_locality',          'Bucaramanga'),
  ('seo_region',            'Santander'),
  ('seo_country',           'CO'),
  ('seo_area_served',       'Bucaramanga y área metropolitana'),
  ('hero_title_line1',      'Domicilios de alimentos'),
  ('hero_title_accent',     'en Bucaramanga'),
  ('hero_subtitle',         'Cárnicos, pulpas, panificados y más, al mejor precio mayorista.'),
  ('footer_description',    'SURTÉ YA — tu surtidor mayorista de confianza en Santander.'),
  ('business_hours_open',   '07:00'),
  ('business_hours_close',  '20:00'),
  ('whatsapp_phone',        '+573001234567')
) AS kv(key, value)
ON CONFLICT (organization_id, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- 4) Modules activos ---------------------------------------------------------
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya')
INSERT INTO public.organization_modules (organization_id, module_code, is_enabled)
SELECT org.id, m.code, true
FROM org, (VALUES
  ('storefront'),
  ('pos'),
  ('inventory'),
  ('whatsapp'),
  ('einvoice')
) AS m(code)
ON CONFLICT (organization_id, module_code) DO UPDATE SET is_enabled = true;

COMMIT;

-- ============================================================================
-- Post-seed checklist (manual, by superadmin):
--   * Upload logo via Admin → Configuración → Branding.
--   * Configure DIAN/Innapsis credentials in einvoice_configs.
--   * Configure YCloud token in secrets (WHATSAPP_YCLOUD_TOKEN).
--   * Import product catalog (CSV) or run the catalog_template `food-mayorista`.
-- ============================================================================
