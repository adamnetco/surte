
-- =========================================
-- SPRINT 0: Multi-tenant foundation
-- Non-destructive: nullable FKs + seed org
-- =========================================

-- 1. Core tables
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type text NOT NULL DEFAULT 'retail',
  country text NOT NULL DEFAULT 'CO',
  currency text NOT NULL DEFAULT 'COP',
  timezone text NOT NULL DEFAULT 'America/Bogota',
  tax_id text,
  logo_url text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  location_ids uuid[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_subscription_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_org ON public.organization_modules(organization_id);

-- updated_at triggers
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_members_updated BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_modules_updated BEFORE UPDATE ON public.organization_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Helper SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.is_member_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = auth.uid()
      AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.org_role(_org_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_module(_org_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_modules
    WHERE organization_id = _org_id
      AND module_key = _module_key
      AND enabled = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.default_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.organizations WHERE slug = 'surteya' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_orgs(_user_id uuid)
RETURNS TABLE(organization_id uuid, role text, slug text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.organization_id, m.role, o.slug, o.name
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = _user_id AND m.is_active = true AND o.is_active = true
  ORDER BY m.joined_at ASC
$$;

-- 4. RLS policies
CREATE POLICY "members read their orgs" ON public.organizations
  FOR SELECT USING (public.is_member_of(id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role]));

CREATE POLICY "owners update their org" ON public.organizations
  FOR UPDATE USING (public.org_role(id) IN ('owner','admin') OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
  WITH CHECK (public.org_role(id) IN ('owner','admin') OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE POLICY "superadmin manages orgs" ON public.organizations
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE POLICY "members read org members" ON public.organization_members
  FOR SELECT USING (public.is_member_of(organization_id) OR user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE POLICY "owners manage members" ON public.organization_members
  FOR ALL USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
  WITH CHECK (public.org_role(organization_id) IN ('owner','admin') OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE POLICY "members read modules" ON public.organization_modules
  FOR SELECT USING (public.is_member_of(organization_id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role]));

CREATE POLICY "owners manage modules" ON public.organization_modules
  FOR ALL USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
  WITH CHECK (public.org_role(organization_id) IN ('owner','admin') OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE POLICY "members read subscription" ON public.subscriptions
  FOR SELECT USING (public.is_member_of(organization_id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role]));

CREATE POLICY "superadmin manages subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 5. Seed default organization
INSERT INTO public.organizations (slug, name, business_type, country, currency, timezone, settings)
VALUES ('surteya', 'SurteYa Bucaramanga', 'hybrid_ecommerce_pos', 'CO', 'COP', 'America/Bogota',
        jsonb_build_object('seeded', true, 'origin', 'sprint_0'))
ON CONFLICT (slug) DO NOTHING;

-- 6. Seed default modules
INSERT INTO public.organization_modules (organization_id, module_key, enabled)
SELECT o.id, m.key, true
FROM public.organizations o
CROSS JOIN (VALUES
  ('ecommerce'),
  ('b2b_wholesale'),
  ('pos_counter'),
  ('einvoice_innapsis'),
  ('delivery_own'),
  ('loyalty')
) AS m(key)
WHERE o.slug = 'surteya'
ON CONFLICT (organization_id, module_key) DO NOTHING;

-- 7. Seed subscription (trial open-ended for the seed org)
INSERT INTO public.subscriptions (organization_id, plan, status, current_period_start, current_period_end)
SELECT id, 'founder', 'active', now(), now() + interval '10 years'
FROM public.organizations WHERE slug = 'surteya'
ON CONFLICT (organization_id) DO NOTHING;

-- 8. Backfill all existing auth users as members of the default org
--    Map app_role -> org role (superadmin/admin -> owner, editor -> manager, agente -> agent, user -> member)
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT
  (SELECT id FROM public.organizations WHERE slug = 'surteya'),
  u.id,
  CASE
    WHEN public.has_any_role(u.id, ARRAY['superadmin'::app_role]) THEN 'owner'
    WHEN public.has_any_role(u.id, ARRAY['admin'::app_role]) THEN 'admin'
    WHEN public.has_any_role(u.id, ARRAY['editor'::app_role]) THEN 'manager'
    WHEN public.has_any_role(u.id, ARRAY['agente'::app_role]) THEN 'agent'
    ELSE 'member'
  END,
  true
FROM auth.users u
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 9. Add nullable organization_id to business tables (soft, no RLS change yet)
ALTER TABLE public.products            ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.categories          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.brands              ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.orders              ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.order_items         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.profiles            ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.product_presentations ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.product_media       ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.modifier_groups     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.modifier_options    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.coupons             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.banners             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.hero_slides         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.landing_pages       ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.shipping_zones      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.municipality_settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.featured_sections   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.persistent_carts    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.custom_scripts      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.seo_content         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.app_settings        ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.gallery             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.customer_reviews    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.google_reviews      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 10. Backfill all existing rows to the seed org
DO $$
DECLARE
  v_org uuid;
  t text;
  tables text[] := ARRAY[
    'products','categories','brands','orders','order_items','profiles',
    'product_presentations','product_media','modifier_groups','modifier_options',
    'coupons','banners','hero_slides','landing_pages','shipping_zones',
    'municipality_settings','featured_sections','persistent_carts','custom_scripts',
    'seo_content','app_settings','gallery','customer_reviews','google_reviews'
  ];
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'surteya';
  IF v_org IS NULL THEN RETURN; END IF;
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', t) USING v_org;
  END LOOP;
END$$;

-- 11. Indexes on new FKs
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
