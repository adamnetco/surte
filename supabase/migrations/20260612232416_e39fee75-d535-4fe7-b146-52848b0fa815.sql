-- tenant_module_overrides
CREATE TABLE public.tenant_module_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  reason text,
  granted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_module_overrides TO authenticated;
GRANT ALL ON public.tenant_module_overrides TO service_role;
ALTER TABLE public.tenant_module_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage module overrides" ON public.tenant_module_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Org admins view their module overrides" ON public.tenant_module_overrides
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tenant_module_overrides.organization_id
      AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));
CREATE INDEX idx_tmo_org ON public.tenant_module_overrides(organization_id);

-- tenant_limit_overrides
CREATE TABLE public.tenant_limit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  value bigint,
  reason text,
  granted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, limit_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_limit_overrides TO authenticated;
GRANT ALL ON public.tenant_limit_overrides TO service_role;
ALTER TABLE public.tenant_limit_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage limit overrides" ON public.tenant_limit_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Org admins view their limit overrides" ON public.tenant_limit_overrides
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tenant_limit_overrides.organization_id
      AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));
CREATE INDEX idx_tlo_org ON public.tenant_limit_overrides(organization_id);

-- tenant_usage_counters
CREATE TABLE public.tenant_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  period_key text NOT NULL DEFAULT 'lifetime',
  used bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, limit_key, period_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_usage_counters TO authenticated;
GRANT ALL ON public.tenant_usage_counters TO service_role;
ALTER TABLE public.tenant_usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins view all counters" ON public.tenant_usage_counters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Org members view their counters" ON public.tenant_usage_counters
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tenant_usage_counters.organization_id AND om.user_id = auth.uid()));
CREATE INDEX idx_tuc_org_period ON public.tenant_usage_counters(organization_id, period_key);

CREATE TRIGGER trg_tmo_updated_at BEFORE UPDATE ON public.tenant_module_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tlo_updated_at BEFORE UPDATE ON public.tenant_limit_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolved entitlement views (plan from active subscription)
CREATE OR REPLACE VIEW public.v_tenant_entitlements_modules AS
SELECT
  o.id AS organization_id,
  m.key AS module_key,
  m.name AS module_name,
  m.category,
  CASE
    WHEN tmo.enabled IS NOT NULL AND (tmo.expires_at IS NULL OR tmo.expires_at > now())
      THEN tmo.enabled
    WHEN pm.included IS TRUE THEN true
    ELSE false
  END AS enabled,
  CASE
    WHEN tmo.enabled IS NOT NULL AND (tmo.expires_at IS NULL OR tmo.expires_at > now())
      THEN 'override'
    WHEN pm.included IS TRUE THEN 'plan'
    ELSE 'none'
  END AS source
FROM public.organizations o
CROSS JOIN public.modules m
LEFT JOIN LATERAL (
  SELECT plan_id FROM public.subscriptions s
  WHERE s.organization_id = o.id AND s.status IN ('active','trialing','past_due')
  ORDER BY s.created_at DESC LIMIT 1
) sub ON true
LEFT JOIN public.plan_modules pm ON pm.plan_id = sub.plan_id AND pm.module_key = m.key
LEFT JOIN public.tenant_module_overrides tmo
  ON tmo.organization_id = o.id AND tmo.module_key = m.key
WHERE m.is_active = true;

GRANT SELECT ON public.v_tenant_entitlements_modules TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_tenant_entitlements_limits AS
SELECT
  o.id AS organization_id,
  pl.limit_key,
  COALESCE(tlo.value, pl.value) AS effective_value,
  pl.value AS plan_value,
  tlo.value AS override_value,
  CASE WHEN tlo.value IS NOT NULL AND (tlo.expires_at IS NULL OR tlo.expires_at > now())
    THEN 'override' ELSE 'plan' END AS source
FROM public.organizations o
LEFT JOIN LATERAL (
  SELECT plan_id FROM public.subscriptions s
  WHERE s.organization_id = o.id AND s.status IN ('active','trialing','past_due')
  ORDER BY s.created_at DESC LIMIT 1
) sub ON true
LEFT JOIN public.plan_limits pl ON pl.plan_id = sub.plan_id
LEFT JOIN public.tenant_limit_overrides tlo
  ON tlo.organization_id = o.id AND tlo.limit_key = pl.limit_key
WHERE pl.limit_key IS NOT NULL;

GRANT SELECT ON public.v_tenant_entitlements_limits TO authenticated, service_role;