
CREATE OR REPLACE FUNCTION public.get_billing_overview(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_member boolean;
  v_sub jsonb;
  v_plan jsonb;
  v_usage jsonb;
  v_addons jsonb;
BEGIN
  -- Authz: must be member of org OR superadmin
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'superadmin') INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Subscription + plan
  SELECT to_jsonb(s.*) INTO v_sub
  FROM public.subscriptions s
  WHERE s.organization_id = p_org_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub IS NOT NULL THEN
    SELECT to_jsonb(p.*) INTO v_plan
    FROM public.saas_plans p
    WHERE p.id = (v_sub->>'plan_id')::uuid;
  END IF;

  -- Usage vs limits (lifetime + current month, merged with overrides)
  WITH base_limits AS (
    SELECT pl.limit_key, pl.limit_value
    FROM public.plan_limits pl
    WHERE pl.plan_id = (v_sub->>'plan_id')::uuid
  ),
  overrides AS (
    SELECT o.limit_key, o.limit_value
    FROM public.tenant_limit_overrides o
    WHERE o.organization_id = p_org_id
      AND (o.expires_at IS NULL OR o.expires_at > now())
  ),
  effective AS (
    SELECT
      COALESCE(o.limit_key, b.limit_key) AS limit_key,
      COALESCE(o.limit_value, b.limit_value) AS limit_value,
      CASE WHEN o.limit_key IS NOT NULL THEN 'override' ELSE 'plan' END AS source
    FROM base_limits b
    FULL OUTER JOIN overrides o ON o.limit_key = b.limit_key
  ),
  counters AS (
    SELECT limit_key, COALESCE(SUM(used), 0)::bigint AS used
    FROM public.tenant_usage_counters
    WHERE organization_id = p_org_id
      AND period_key IN ('lifetime', to_char(now(), 'YYYY-MM'))
    GROUP BY limit_key
  )
  SELECT jsonb_agg(jsonb_build_object(
    'limit_key', e.limit_key,
    'limit_value', e.limit_value,
    'used', COALESCE(c.used, 0),
    'remaining', CASE WHEN e.limit_value IS NULL THEN NULL ELSE GREATEST(0, e.limit_value - COALESCE(c.used, 0)) END,
    'pct', CASE WHEN e.limit_value IS NULL OR e.limit_value = 0 THEN 0 ELSE LEAST(100, ROUND((COALESCE(c.used, 0)::numeric / e.limit_value) * 100)) END,
    'source', e.source
  ) ORDER BY e.limit_key)
  INTO v_usage
  FROM effective e
  LEFT JOIN counters c ON c.limit_key = e.limit_key;

  -- Active add-ons
  SELECT jsonb_agg(jsonb_build_object(
    'addon_code', ta.addon_code,
    'quantity', ta.quantity,
    'starts_at', ta.starts_at,
    'ends_at', ta.ends_at,
    'name', a.name,
    'description', a.description
  ))
  INTO v_addons
  FROM public.tenant_addons ta
  LEFT JOIN public.addons a ON a.code = ta.addon_code
  WHERE ta.organization_id = p_org_id
    AND ta.status = 'active'
    AND (ta.ends_at IS NULL OR ta.ends_at > now());

  RETURN jsonb_build_object(
    'subscription', v_sub,
    'plan', v_plan,
    'usage', COALESCE(v_usage, '[]'::jsonb),
    'addons', COALESCE(v_addons, '[]'::jsonb),
    'resolved_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_billing_overview(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_billing_overview(uuid) FROM anon, public;
