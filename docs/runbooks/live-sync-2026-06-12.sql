-- ============================================================================
-- live-sync-2026-06-12.sql
-- Objetivo: desbloquear el publish en Live alineando datos con migraciones Test.
-- Ejecutar en: Lovable Cloud → Backend → Run SQL (con LIVE seleccionado).
-- Idempotente: se puede correr múltiples veces sin efectos secundarios.
-- ============================================================================

BEGIN;

-- 1) Asegurar tenant base "surteya" (semilla de migración Etapa 4) ------------
INSERT INTO public.organizations (id, slug, name, business_type, is_active)
VALUES (
  '8234b6ee-b680-4a11-9815-e8183ad28b86',
  'surteya',
  'SurteYa Bucaramanga',
  'retail',
  true
)
ON CONFLICT (slug) DO UPDATE SET is_active = true, updated_at = now();

-- 2) Backfill organization_id en tablas que la migración pone NOT NULL --------
DO $$
DECLARE
  v_org uuid;
  t text;
  tables text[] := ARRAY[
    'products','categories','brands','product_presentations',
    'hero_slides','banners','landing_pages','featured_sections',
    'gallery','customer_reviews','crm_leads','custom_scripts',
    'seo_content','modifier_groups','modifier_options','shipping_zones'
  ];
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'surteya' LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organizations.surteya no existe — abortar';
  END IF;

  FOREACH t IN ARRAY tables LOOP
    -- Solo intenta el UPDATE si la tabla y la columna existen
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='organization_id'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', t
      ) USING v_org;
      RAISE NOTICE 'Backfilled %', t;
    ELSE
      RAISE NOTICE 'Skip %: tabla/columna no presente todavía', t;
    END IF;
  END LOOP;
END $$;

-- 3) Verificación (debe devolver 0 huérfanos por tabla) ----------------------
SELECT 'products'              AS tabla, COUNT(*) AS huerfanos FROM public.products              WHERE organization_id IS NULL
UNION ALL SELECT 'categories',            COUNT(*) FROM public.categories            WHERE organization_id IS NULL
UNION ALL SELECT 'brands',                COUNT(*) FROM public.brands                WHERE organization_id IS NULL
UNION ALL SELECT 'product_presentations', COUNT(*) FROM public.product_presentations WHERE organization_id IS NULL
UNION ALL SELECT 'hero_slides',           COUNT(*) FROM public.hero_slides           WHERE organization_id IS NULL
UNION ALL SELECT 'banners',               COUNT(*) FROM public.banners               WHERE organization_id IS NULL
UNION ALL SELECT 'landing_pages',         COUNT(*) FROM public.landing_pages         WHERE organization_id IS NULL
UNION ALL SELECT 'featured_sections',     COUNT(*) FROM public.featured_sections     WHERE organization_id IS NULL
UNION ALL SELECT 'gallery',               COUNT(*) FROM public.gallery               WHERE organization_id IS NULL
UNION ALL SELECT 'customer_reviews',      COUNT(*) FROM public.customer_reviews      WHERE organization_id IS NULL
UNION ALL SELECT 'crm_leads',             COUNT(*) FROM public.crm_leads             WHERE organization_id IS NULL
UNION ALL SELECT 'custom_scripts',        COUNT(*) FROM public.custom_scripts        WHERE organization_id IS NULL
UNION ALL SELECT 'seo_content',           COUNT(*) FROM public.seo_content           WHERE organization_id IS NULL
UNION ALL SELECT 'modifier_groups',       COUNT(*) FROM public.modifier_groups       WHERE organization_id IS NULL
UNION ALL SELECT 'modifier_options',      COUNT(*) FROM public.modifier_options      WHERE organization_id IS NULL
UNION ALL SELECT 'shipping_zones',        COUNT(*) FROM public.shipping_zones        WHERE organization_id IS NULL;

COMMIT;
-- Tras ver todos los conteos en 0, vuelve a Publish → Update.
