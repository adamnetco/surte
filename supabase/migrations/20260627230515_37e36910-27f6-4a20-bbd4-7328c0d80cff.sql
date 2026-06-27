-- 1) Catálogo de add-ons
CREATE TABLE public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cop numeric(12,2) NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'one_shot' CHECK (billing_period IN ('one_shot','monthly','yearly')),
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.addons TO anon, authenticated;
GRANT ALL ON public.addons TO service_role;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addons_public_read_active" ON public.addons FOR SELECT USING (is_active = true);
CREATE POLICY "addons_superadmin_all" ON public.addons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.addon_features (
  addon_code text NOT NULL REFERENCES public.addons(code) ON DELETE CASCADE,
  module_key text NOT NULL,
  PRIMARY KEY (addon_code, module_key)
);
GRANT SELECT ON public.addon_features TO anon, authenticated;
GRANT ALL ON public.addon_features TO service_role;
ALTER TABLE public.addon_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addon_features_read" ON public.addon_features FOR SELECT USING (true);
CREATE POLICY "addon_features_superadmin" ON public.addon_features FOR ALL TO authenticated USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.addon_limits (
  addon_code text NOT NULL REFERENCES public.addons(code) ON DELETE CASCADE,
  limit_key text NOT NULL,
  value_delta bigint NOT NULL,
  PRIMARY KEY (addon_code, limit_key)
);
GRANT SELECT ON public.addon_limits TO anon, authenticated;
GRANT ALL ON public.addon_limits TO service_role;
ALTER TABLE public.addon_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addon_limits_read" ON public.addon_limits FOR SELECT USING (true);
CREATE POLICY "addon_limits_superadmin" ON public.addon_limits FOR ALL TO authenticated USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.tenant_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  addon_code text NOT NULL REFERENCES public.addons(code) ON DELETE RESTRICT,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','canceled','failed')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  wompi_transaction_id text,
  wompi_reference text,
  amount_paid_cop numeric(12,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_addons_org ON public.tenant_addons(organization_id, status);
CREATE INDEX idx_tenant_addons_active ON public.tenant_addons(organization_id, addon_code) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE ON public.tenant_addons TO authenticated;
GRANT ALL ON public.tenant_addons TO service_role;
ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_addons_member_read" ON public.tenant_addons FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id) OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "tenant_addons_admin_insert" ON public.tenant_addons FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'superadmin') OR public.org_role(organization_id) IN ('owner','admin'));
CREATE POLICY "tenant_addons_admin_update" ON public.tenant_addons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.org_role(organization_id) IN ('owner','admin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin') OR public.org_role(organization_id) IN ('owner','admin'));
CREATE POLICY "tenant_addons_superadmin_delete" ON public.tenant_addons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_addons_updated_at BEFORE UPDATE ON public.addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tenant_addons_updated_at BEFORE UPDATE ON public.tenant_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: resolver add-ons activos sin anidar agregados
CREATE OR REPLACE FUNCTION public.resolve_tenant_addons(p_org_id uuid)
RETURNS TABLE (
  addon_code text,
  quantity int,
  modules text[],
  limits jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT ta.addon_code, SUM(ta.quantity)::int AS qty
    FROM public.tenant_addons ta
    WHERE ta.organization_id = p_org_id
      AND ta.status = 'active'
      AND (ta.ends_at IS NULL OR ta.ends_at > now())
    GROUP BY ta.addon_code
  ),
  mods AS (
    SELECT a.addon_code, COALESCE(ARRAY_AGG(af.module_key) FILTER (WHERE af.module_key IS NOT NULL), '{}') AS modules
    FROM agg a LEFT JOIN public.addon_features af ON af.addon_code = a.addon_code
    GROUP BY a.addon_code
  ),
  lims AS (
    SELECT a.addon_code,
           COALESCE(jsonb_object_agg(al.limit_key, al.value_delta * a.qty) FILTER (WHERE al.limit_key IS NOT NULL), '{}'::jsonb) AS limits
    FROM agg a LEFT JOIN public.addon_limits al ON al.addon_code = a.addon_code
    GROUP BY a.addon_code
  )
  SELECT a.addon_code, a.qty AS quantity, m.modules, l.limits
  FROM agg a
  JOIN mods m ON m.addon_code = a.addon_code
  JOIN lims l ON l.addon_code = a.addon_code;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_addons(uuid) TO authenticated, service_role;

INSERT INTO public.addons (code, name, description, price_cop, billing_period, icon, sort_order) VALUES
  ('extra_products_500', '+500 productos', 'Amplía tu catálogo en 500 productos adicionales sobre tu plan actual.', 29900, 'monthly', 'Package', 10),
  ('extra_users_5', '+5 usuarios', 'Suma 5 cuentas de usuario adicionales a tu organización.', 19900, 'monthly', 'Users', 20),
  ('einvoice_pack_100', 'Paquete 100 facturas electrónicas', 'Bolsa adicional de 100 emisiones de facturación electrónica DIAN. Vigencia: el mes en curso.', 39900, 'one_shot', 'FileText', 30),
  ('extra_location_1', '+1 sucursal', 'Habilita una sucursal adicional para tu organización.', 49900, 'monthly', 'Store', 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.addon_limits (addon_code, limit_key, value_delta) VALUES
  ('extra_products_500', 'max_products', 500),
  ('extra_users_5', 'max_users', 5),
  ('einvoice_pack_100', 'einvoices_month', 100),
  ('extra_location_1', 'max_locations', 1)
ON CONFLICT DO NOTHING;
