CREATE OR REPLACE FUNCTION public.resolve_entitlements(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_member boolean;
  v_sub record;
  v_plan record;
  v_modules jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
  v_now timestamptz := now();
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = v_uid
  ) OR public.has_role(v_uid, 'superadmin') INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT s.* INTO v_sub
  FROM public.subscriptions s
  WHERE s.organization_id = p_org_id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_sub.plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.saas_plans WHERE id = v_sub.plan_id;
  ELSIF v_sub.plan IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.saas_plans WHERE key = v_sub.plan;
  ELSE
    SELECT * INTO v_plan FROM public.saas_plans WHERE key = 'free' LIMIT 1;
  END IF;

  v_active := COALESCE(v_sub.status, 'none') IN ('active','trialing','past_due');

  -- Módulos: base del plan
  SELECT jsonb_object_agg(pm.module_key, jsonb_build_object(
    'enabled', pm.included AND v_active,
    'quota', pm.quota_limit,
    'source', 'plan'
  ))
  INTO v_modules
  FROM public.plan_modules pm
  WHERE pm.plan_id = v_plan.id;

  v_modules := COALESCE(v_modules, '{}'::jsonb);

  -- Overrides de módulos (ganan a plan)
  SELECT v_modules || COALESCE(jsonb_object_agg(tmo.module_key, jsonb_build_object(
    'enabled', tmo.enabled,
    'quota', NULL,
    'source', 'override',
    'expires_at', tmo.expires_at
  )), '{}'::jsonb)
  INTO v_modules
  FROM public.tenant_module_overrides tmo
  WHERE tmo.organization_id = p_org_id
    AND (tmo.expires_at IS NULL OR tmo.expires_at > v_now);

  -- Límites del plan
  SELECT jsonb_object_agg(pl.limit_key, jsonb_build_object('value', pl.value, 'source','plan'))
  INTO v_limits
  FROM public.plan_limits pl
  WHERE pl.plan_id = v_plan.id;

  v_limits := COALESCE(v_limits, '{}'::jsonb);

  -- Overrides de límites
  SELECT v_limits || COALESCE(jsonb_object_agg(tlo.limit_key, jsonb_build_object(
    'value', tlo.value, 'source','override', 'expires_at', tlo.expires_at
  )), '{}'::jsonb)
  INTO v_limits
  FROM public.tenant_limit_overrides tlo
  WHERE tlo.organization_id = p_org_id
    AND (tlo.expires_at IS NULL OR tlo.expires_at > v_now);

  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'plan_key', COALESCE(v_plan.key, 'free'),
    'plan_name', v_plan.name,
    'status', COALESCE(v_sub.status, 'none'),
    'active', v_active,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
    'modules', v_modules,
    'limits', v_limits,
    'resolved_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_entitlements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_entitlements(uuid) TO authenticated, service_role;
