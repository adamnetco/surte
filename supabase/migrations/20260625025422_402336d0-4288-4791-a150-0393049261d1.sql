-- Phase 7: Multi-tenant price lists for B2B clients
-- Replaces per-user "tipología de precio" (business_type) on profiles with
-- a FK to a tenant-scoped price list assigned per customer.

CREATE TABLE IF NOT EXISTS public.price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'COP',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_lists TO authenticated;
GRANT ALL ON public.price_lists TO service_role;

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_lists_select_org_members" ON public.price_lists
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "price_lists_modify_admins" ON public.price_lists
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'admin')
    OR organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'admin')
    OR organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_price_lists_org ON public.price_lists(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_one_default_per_org
  ON public.price_lists(organization_id) WHERE is_default = true;

CREATE TRIGGER trg_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-product overrides inside a list (price or % discount)
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  presentation_id UUID REFERENCES public.product_presentations(id) ON DELETE CASCADE,
  price NUMERIC(14,2),
  discount_pct NUMERIC(5,2),
  min_qty NUMERIC(14,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (price_list_id, product_id, presentation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_items TO authenticated;
GRANT ALL ON public.price_list_items TO service_role;

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_list_items_select_org" ON public.price_list_items
  FOR SELECT TO authenticated
  USING (
    price_list_id IN (SELECT id FROM public.price_lists)
  );

CREATE POLICY "price_list_items_modify_admins" ON public.price_list_items
  FOR ALL TO authenticated
  USING (
    price_list_id IN (
      SELECT pl.id FROM public.price_lists pl
      WHERE public.has_role(auth.uid(), 'superadmin')
         OR public.has_role(auth.uid(), 'admin')
         OR pl.organization_id IN (
           SELECT om.organization_id FROM public.organization_members om
           WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
         )
    )
  )
  WITH CHECK (
    price_list_id IN (
      SELECT pl.id FROM public.price_lists pl
      WHERE public.has_role(auth.uid(), 'superadmin')
         OR public.has_role(auth.uid(), 'admin')
         OR pl.organization_id IN (
           SELECT om.organization_id FROM public.organization_members om
           WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
         )
    )
  );

CREATE INDEX IF NOT EXISTS idx_pli_list ON public.price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_pli_product ON public.price_list_items(product_id);

CREATE TRIGGER trg_price_list_items_updated_at
  BEFORE UPDATE ON public.price_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link customers (profiles) to a price list. Nullable = use org default.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_price_list ON public.profiles(price_list_id);
