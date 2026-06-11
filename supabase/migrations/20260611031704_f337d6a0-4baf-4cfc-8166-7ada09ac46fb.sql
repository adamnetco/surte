
-- ============================================================
-- Etapa 4: Multi-tenant hardening
-- 1) Backfill organization_id on tables with NULL rows
-- 2) Enforce NOT NULL + FK on core tenant tables
-- 3) Deprecate default_org_id() (raises exception)
-- 4) Add helper current_org_id() for triggers/policies
-- ============================================================

-- 1.a Backfill product_presentations from parent product
UPDATE public.product_presentations pp
SET organization_id = p.organization_id
FROM public.products p
WHERE pp.product_id = p.id
  AND pp.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

-- 1.b Backfill orphan persistent_carts to legacy tenant (surteya)
UPDATE public.persistent_carts
SET organization_id = (SELECT id FROM public.organizations WHERE slug='surteya' LIMIT 1)
WHERE organization_id IS NULL;

-- 2. Enforce NOT NULL + FK on core tenant tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'products','categories','brands','product_presentations',
    'hero_slides','banners','landing_pages','featured_sections',
    'gallery','customer_reviews','crm_leads','custom_scripts',
    'seo_content','modifier_groups','modifier_options','shipping_zones'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
    -- Add FK if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema='public' AND tc.table_name=t
        AND tc.constraint_type='FOREIGN KEY'
        AND tc.constraint_name = t || '_organization_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE',
        t, t || '_organization_id_fkey'
      );
    END IF;
    -- Index for tenant lookups
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
      'idx_' || t || '_org', t
    );
  END LOOP;
END $$;

-- 3. Deprecate default_org_id() — raises so any forgotten caller surfaces immediately
CREATE OR REPLACE FUNCTION public.default_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION 'default_org_id() is deprecated — use current_org_id() or pass organization_id explicitly (Etapa 4 multi-tenant refactor)';
END;
$fn$;

COMMENT ON FUNCTION public.default_org_id() IS
  'DEPRECATED (Etapa 4): raises. Use current_org_id() or explicit organization_id.';

-- 4. Helper current_org_id(): first active org of caller, or NULL
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY joined_at ASC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.default_org_id() FROM PUBLIC, anon, authenticated;
