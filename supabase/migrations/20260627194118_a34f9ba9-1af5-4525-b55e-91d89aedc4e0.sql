
-- ============================================================
-- Ola 16 Slice 3: consume_limit + gate_denial + denials view
-- ============================================================

-- Atomic limit consumption
CREATE OR REPLACE FUNCTION public.consume_limit(
  p_org_id uuid,
  p_limit_key text,
  p_amount integer DEFAULT 1,
  p_period_key text DEFAULT 'lifetime'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_value bigint;
  v_used bigint;
  v_new_used bigint;
  v_member boolean;
BEGIN
  -- Authz: superadmin OR member of org
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) INTO v_member;

  IF NOT COALESCE(v_member, false) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  -- Resolve effective limit from view (plan + overrides)
  SELECT effective_value INTO v_limit_value
  FROM public.v_tenant_entitlements_limits
  WHERE organization_id = p_org_id AND limit_key = p_limit_key
  LIMIT 1;

  -- Atomic upsert + increment with row lock
  INSERT INTO public.tenant_usage_counters (organization_id, limit_key, period_key, used)
  VALUES (p_org_id, p_limit_key, p_period_key, 0)
  ON CONFLICT (organization_id, limit_key, period_key) DO NOTHING;

  SELECT used INTO v_used
  FROM public.tenant_usage_counters
  WHERE organization_id = p_org_id AND limit_key = p_limit_key AND period_key = p_period_key
  FOR UPDATE;

  -- NULL limit_value = unlimited
  IF v_limit_value IS NOT NULL AND (v_used + p_amount) > v_limit_value THEN
    -- Record denial
    INSERT INTO public.usage_events (organization_id, module_key, metric, quantity, user_id, metadata)
    VALUES (
      p_org_id, p_limit_key, 'limit_denied', p_amount, auth.uid(),
      jsonb_build_object('limit', v_limit_value, 'used', v_used, 'period', p_period_key)
    );
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'limit_exceeded',
      'limit', v_limit_value, 'used', v_used, 'period', p_period_key
    );
  END IF;

  v_new_used := v_used + p_amount;
  UPDATE public.tenant_usage_counters
  SET used = v_new_used, updated_at = now()
  WHERE organization_id = p_org_id AND limit_key = p_limit_key AND period_key = p_period_key;

  INSERT INTO public.usage_events (organization_id, module_key, metric, quantity, user_id, metadata)
  VALUES (
    p_org_id, p_limit_key, 'limit_consumed', p_amount, auth.uid(),
    jsonb_build_object('limit', v_limit_value, 'used', v_new_used, 'period', p_period_key)
  );

  RETURN jsonb_build_object(
    'allowed', true, 'limit', v_limit_value, 'used', v_new_used,
    'remaining', CASE WHEN v_limit_value IS NULL THEN NULL ELSE v_limit_value - v_new_used END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_limit(uuid, text, integer, text) TO authenticated;

-- Generic gate denial logger (modules, subscription, etc.)
CREATE OR REPLACE FUNCTION public.gate_denial(
  p_org_id uuid,
  p_kind text,        -- 'module' | 'subscription' | 'limit'
  p_key text,         -- module_key, status, or limit_key
  p_reason text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
  ) THEN
    RETURN; -- silently ignore
  END IF;

  INSERT INTO public.usage_events (organization_id, module_key, metric, quantity, user_id, metadata)
  VALUES (
    p_org_id, p_key, 'gate_denied', 1, auth.uid(),
    jsonb_build_object('kind', p_kind, 'reason', p_reason) || COALESCE(p_context, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gate_denial(uuid, text, text, text, jsonb) TO authenticated;

-- Denial analytics view (superadmin only)
CREATE OR REPLACE VIEW public.v_gate_denials_daily AS
SELECT
  organization_id,
  date_trunc('day', created_at)::date AS day,
  metric,
  module_key AS key,
  COUNT(*)::bigint AS denials,
  COUNT(DISTINCT user_id)::bigint AS distinct_users,
  MAX(created_at) AS last_denial_at
FROM public.usage_events
WHERE metric IN ('limit_denied', 'gate_denied')
GROUP BY organization_id, day, metric, module_key;

GRANT SELECT ON public.v_gate_denials_daily TO authenticated;

-- RLS already on usage_events; the view inherits via security_invoker default? Use security barrier:
ALTER VIEW public.v_gate_denials_daily SET (security_invoker = true);
