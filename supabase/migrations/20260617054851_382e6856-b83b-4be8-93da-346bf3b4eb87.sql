
-- 1) Mark organization_modules as DEPRECATED
COMMENT ON TABLE public.organization_modules IS
  'DEPRECATED 2026-06-17 — Replaced by entitlements system (plan_modules + tenant_module_overrides via v_tenant_entitlements_modules). Do not write from new code. Pending removal once all reads migrate to useEntitlements(). See docs/specs/POS-entitlements-wizard-unification.md';

-- 2) RPC: purge module overrides that are redundant or contradict the current plan
CREATE OR REPLACE FUNCTION public.superadmin_purge_obsolete_overrides(_organization_id uuid)
RETURNS TABLE(purged_module_key text, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_super boolean;
BEGIN
  -- Authz: only superadmin role can purge
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  ) INTO _is_super;

  IF NOT _is_super THEN
    RAISE EXCEPTION 'forbidden: superadmin role required';
  END IF;

  RETURN QUERY
  WITH plan_for_org AS (
    SELECT s.plan_id
    FROM public.subscriptions s
    WHERE s.organization_id = _organization_id
      AND s.status IN ('active','trialing')
    ORDER BY s.created_at DESC
    LIMIT 1
  ),
  to_purge AS (
    DELETE FROM public.tenant_module_overrides tmo
    USING plan_for_org p
    LEFT JOIN public.plan_modules pm
      ON pm.plan_id = p.plan_id AND pm.module_key = tmo.module_key
    WHERE tmo.organization_id = _organization_id
      AND (
        -- Override enables a module the plan does NOT include (illegal)
        (tmo.enabled = true AND COALESCE(pm.included, false) = false)
        -- Override disables a module the plan does NOT include either (redundant)
        OR (tmo.enabled = false AND COALESCE(pm.included, false) = false)
      )
    RETURNING tmo.module_key,
      CASE
        WHEN tmo.enabled = true THEN 'plan_no_longer_includes_module'
        ELSE 'redundant_disable'
      END AS r
  )
  SELECT module_key, r FROM to_purge;
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_purge_obsolete_overrides(uuid) TO authenticated;

-- 3) Helper: cheapest plan that includes a given module (used by upgrade modal)
CREATE OR REPLACE FUNCTION public.get_upgrade_target_plan(_module_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.key
  FROM public.plan_modules pm
  JOIN public.saas_plans sp ON sp.id = pm.plan_id
  WHERE pm.module_key = _module_key
    AND pm.included = true
    AND sp.is_public = true
  ORDER BY sp.price_monthly ASC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_upgrade_target_plan(text) TO authenticated, anon;
