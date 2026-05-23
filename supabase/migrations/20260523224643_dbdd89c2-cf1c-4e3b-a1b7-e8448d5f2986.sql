
-- ============================================================
-- FASE B + C: CMS de landings tipado + CRM + signup requests
-- ============================================================

-- 1) Extender landing_pages para SEO completo y reutilización entre proyectos
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-CO',
  ADD COLUMN IF NOT EXISTS json_ld jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hero jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS site_scope text NOT NULL DEFAULT 'sistecpos',
  ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_landing_pages_scope_slug
  ON public.landing_pages (site_scope, slug) WHERE is_active = true;

-- 2) Bloques tipados de cada landing (Hero, Features, Pricing, Testimonials, CTA, Custom)
CREATE TABLE IF NOT EXISTS public.landing_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landing_sections_page ON public.landing_sections(landing_page_id, sort_order);

ALTER TABLE public.landing_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landing_sections_public_read"
  ON public.landing_sections FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.landing_pages lp
      WHERE lp.id = landing_sections.landing_page_id AND lp.is_active = true
    )
  );

CREATE POLICY "landing_sections_admin_all"
  ON public.landing_sections FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::app_role[]));

CREATE TRIGGER trg_landing_sections_updated
  BEFORE UPDATE ON public.landing_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) CRM Leads (captados desde sistecpos.com: agendar demo, contacto, comparador)
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  business_name text,
  business_type text,
  city text,
  source text NOT NULL DEFAULT 'web',
  source_page text,
  plan_interest text,
  modules_interest text[] DEFAULT '{}',
  message text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  converted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status_created ON public.crm_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON public.crm_leads(lower(email));
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_leads_admin_read"
  ON public.crm_leads FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['superadmin','admin','editor']::app_role[]));

CREATE POLICY "crm_leads_admin_write"
  ON public.crm_leads FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::app_role[]));

-- Inserts públicos solo vía edge function (service_role), por eso NO hay policy INSERT pública.

CREATE TRIGGER trg_crm_leads_updated
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Solicitudes de signup (checkout de licencias antes del pago confirmado)
CREATE TABLE IF NOT EXISTS public.org_signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  business_name text NOT NULL,
  business_slug text,
  nit text,
  plan text NOT NULL,
  modules text[] NOT NULL DEFAULT '{}',
  max_terminals integer NOT NULL DEFAULT 1,
  amount_cop numeric(14,2),
  payment_provider text,
  payment_reference text,
  status text NOT NULL DEFAULT 'pending',
  fulfilled_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  fulfilled_license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_signup_status ON public.org_signup_requests(status, created_at DESC);

ALTER TABLE public.org_signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signup_admin_read"
  ON public.org_signup_requests FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::app_role[]));

CREATE POLICY "signup_admin_write"
  ON public.org_signup_requests FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_signup_updated
  BEFORE UPDATE ON public.org_signup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RPC pública para leer una landing con sus secciones (consumida por sistecpos.com y Astro)
CREATE OR REPLACE FUNCTION public.get_landing_by_slug(_scope text, _slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'page', to_jsonb(lp.*),
    'sections', COALESCE((
      SELECT jsonb_agg(to_jsonb(ls.*) ORDER BY ls.sort_order)
      FROM public.landing_sections ls
      WHERE ls.landing_page_id = lp.id AND ls.is_active = true
    ), '[]'::jsonb)
  )
  FROM public.landing_pages lp
  WHERE lp.site_scope = _scope AND lp.slug = _slug AND lp.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_landing_by_slug(text, text) TO anon, authenticated;
