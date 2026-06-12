-- ============================================================================
-- seed_surteya_org.sql — Tenant-specific seed for SurteYa
-- ============================================================================
--
-- Idempotent provisioning of the SurteYa organization (slug, domains, branding,
-- contact, modules, app_settings) as a regular tenant on top of a generic core.
-- The core code/migrations MUST NOT contain any reference to SurteYa.
--
-- Run as service_role in Test / Live when (re)provisioning SurteYa, or invoke
-- from `supabase/functions/reseed-demo`.
-- ============================================================================

BEGIN;

-- 1) Organization ------------------------------------------------------------
INSERT INTO public.organizations (
  slug, name, legal_name, city, region, country, currency, timezone,
  logo_url, primary_color, accent_color,
  support_email, whatsapp_phone,
  hero_title, hero_subtitle, tagline, default_locale,
  is_active
) VALUES (
  'surteya',
  'SURTÉ YA',
  'Conjuguémonos Grupo Empresarial S.A.S.',
  'Bucaramanga',
  'Santander',
  'CO',
  'COP',
  'America/Bogota',
  NULL,
  '#0C4B83',
  '#F37021',
  'hola@surteya.com',
  '+573001234567',
  'Domicilios de alimentos',
  'Cárnicos, pulpas, panificados y más, al mejor precio mayorista.',
  'Tu surtidor mayorista de confianza en Santander.',
  'es-CO',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name           = COALESCE(NULLIF(public.organizations.name, ''), EXCLUDED.name),
  legal_name     = COALESCE(NULLIF(public.organizations.legal_name, ''), EXCLUDED.legal_name),
  city           = COALESCE(NULLIF(public.organizations.city, ''), EXCLUDED.city),
  region         = COALESCE(NULLIF(public.organizations.region, ''), EXCLUDED.region),
  country        = COALESCE(NULLIF(public.organizations.country, ''), EXCLUDED.country),
  currency       = COALESCE(NULLIF(public.organizations.currency, ''), EXCLUDED.currency),
  timezone       = COALESCE(NULLIF(public.organizations.timezone, ''), EXCLUDED.timezone),
  primary_color  = COALESCE(NULLIF(public.organizations.primary_color, ''), EXCLUDED.primary_color),
  accent_color   = COALESCE(NULLIF(public.organizations.accent_color, ''), EXCLUDED.accent_color),
  support_email  = COALESCE(NULLIF(public.organizations.support_email, ''), EXCLUDED.support_email),
  whatsapp_phone = COALESCE(NULLIF(public.organizations.whatsapp_phone, ''), EXCLUDED.whatsapp_phone),
  hero_title     = COALESCE(NULLIF(public.organizations.hero_title, ''), EXCLUDED.hero_title),
  hero_subtitle  = COALESCE(NULLIF(public.organizations.hero_subtitle, ''), EXCLUDED.hero_subtitle),
  tagline        = COALESCE(NULLIF(public.organizations.tagline, ''), EXCLUDED.tagline),
  default_locale = COALESCE(NULLIF(public.organizations.default_locale, ''), EXCLUDED.default_locale),
  is_active      = true,
  updated_at     = now();

-- 2) Domains (idempotent; preserves existing primary) -----------------------
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya')
INSERT INTO public.tenant_domains (organization_id, hostname, is_primary, ssl_status, verified_at)
SELECT org.id, d.hostname, d.is_primary, 'active', now()
FROM org, (VALUES
  ('surteya.sistecpos.com', false),
  ('www.surteya.sistecpos.com', false),
  ('surteya.com',  true),
  ('www.surteya.com', false),
  ('surteya.lovable.app', false)
) AS d(hostname, is_primary)
ON CONFLICT (hostname) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  ssl_status      = COALESCE(public.tenant_domains.ssl_status, 'active'),
  verified_at     = COALESCE(public.tenant_domains.verified_at, now());

-- 3) Org-scoped app_settings (branding, SEO, hero, business hours) ----------
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya')
INSERT INTO public.app_settings (organization_id, key, value)
SELECT org.id, kv.key, kv.value
FROM org, (VALUES
  ('store_name',            'SURTÉ YA'),
  ('store_description',     'Soluciones alimenticias para hogares y negocios en Bucaramanga.'),
  ('site_url',              'https://surteya.com'),
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
  ('whatsapp_phone',        '+573001234567'),
  ('whatsapp_greeting',     'Hola SURTÉ YA, quiero hacer un pedido.')
) AS kv(key, value)
ON CONFLICT (organization_id, key) DO UPDATE SET
  value      = EXCLUDED.value,
  updated_at = now();

-- 4) Modules activos --------------------------------------------------------
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya')
INSERT INTO public.organization_modules (organization_id, module_key, enabled)
SELECT org.id, m.key, true
FROM org, (VALUES
  ('retail'), ('pos'), ('inventario'), ('crm'),
  ('mesas'), ('kds'), ('horeca'), ('agenda'), ('licencias')
) AS m(key)
ON CONFLICT (organization_id, module_key) DO UPDATE SET enabled = true;

COMMIT;

-- ============================================================================
-- Post-seed checklist (manual, by superadmin):
--   * Upload logo via Admin → Configuración → Branding.
--   * Configure DIAN/Innapsis credentials in einvoice_configs.
--   * Configure YCloud token in secrets (WHATSAPP_YCLOUD_TOKEN).
--   * Import product catalog (CSV) or run a catalog_template.
-- ============================================================================
