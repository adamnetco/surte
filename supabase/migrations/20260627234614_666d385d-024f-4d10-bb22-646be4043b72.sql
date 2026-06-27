
CREATE OR REPLACE FUNCTION public.log_upgrade_click(
  p_org_id uuid,
  p_context jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.usage_events (organization_id, module_key, metric, quantity, user_id, metadata)
  VALUES (
    p_org_id,
    COALESCE(p_context->>'key', 'unknown'),
    'upgrade_clicked',
    1,
    auth.uid(),
    COALESCE(p_context, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_upgrade_click(uuid, jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.v_conversion_funnel_daily AS
SELECT
  organization_id,
  date_trunc('day', created_at)::date AS day,
  COUNT(*) FILTER (WHERE metric IN ('limit_denied','module_denied','subscription_denied')) AS denials,
  COUNT(*) FILTER (WHERE metric = 'upgrade_clicked') AS upgrade_clicks,
  COUNT(DISTINCT user_id) FILTER (WHERE metric IN ('limit_denied','module_denied','subscription_denied')) AS users_blocked,
  COUNT(DISTINCT user_id) FILTER (WHERE metric = 'upgrade_clicked') AS users_clicked
FROM public.usage_events
WHERE metric IN ('limit_denied','module_denied','subscription_denied','upgrade_clicked')
GROUP BY 1, 2;

ALTER VIEW public.v_conversion_funnel_daily SET (security_invoker = true);
GRANT SELECT ON public.v_conversion_funnel_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.conversion_funnel_summary(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(days => p_days);
  v_denials int;
  v_clicks int;
  v_addons_approved int;
  v_subs_approved int;
  v_tenants_denied int;
  v_tenants_converted int;
  v_by_reason jsonb;
  v_daily jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE metric IN ('limit_denied','module_denied','subscription_denied')),
    COUNT(*) FILTER (WHERE metric = 'upgrade_clicked'),
    COUNT(DISTINCT organization_id) FILTER (WHERE metric IN ('limit_denied','module_denied','subscription_denied'))
  INTO v_denials, v_clicks, v_tenants_denied
  FROM public.usage_events
  WHERE created_at >= v_since
    AND metric IN ('limit_denied','module_denied','subscription_denied','upgrade_clicked');

  SELECT COUNT(*) INTO v_addons_approved
  FROM public.tenant_addons
  WHERE status = 'active' AND COALESCE(starts_at, created_at) >= v_since;

  SELECT COUNT(*) INTO v_subs_approved
  FROM public.subscription_invoices
  WHERE status IN ('paid','approved') AND created_at >= v_since;

  SELECT COUNT(DISTINCT u.organization_id) INTO v_tenants_converted
  FROM public.usage_events u
  WHERE u.created_at >= v_since
    AND u.metric IN ('limit_denied','module_denied','subscription_denied')
    AND (
      EXISTS (SELECT 1 FROM public.tenant_addons ta WHERE ta.organization_id = u.organization_id AND ta.status = 'active' AND COALESCE(ta.starts_at, ta.created_at) >= v_since)
      OR EXISTS (SELECT 1 FROM public.subscription_invoices si WHERE si.organization_id = u.organization_id AND si.status IN ('paid','approved') AND si.created_at >= v_since)
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_by_reason
  FROM (
    SELECT module_key AS key, metric, COUNT(*)::int AS denials
    FROM public.usage_events
    WHERE created_at >= v_since
      AND metric IN ('limit_denied','module_denied','subscription_denied')
    GROUP BY 1, 2
    ORDER BY 3 DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      date_trunc('day', created_at)::date AS day,
      COUNT(*) FILTER (WHERE metric IN ('limit_denied','module_denied','subscription_denied'))::int AS denials,
      COUNT(*) FILTER (WHERE metric = 'upgrade_clicked')::int AS clicks
    FROM public.usage_events
    WHERE created_at >= v_since
      AND metric IN ('limit_denied','module_denied','subscription_denied','upgrade_clicked')
    GROUP BY 1
  ) d;

  RETURN jsonb_build_object(
    'window_days', p_days,
    'denials', v_denials,
    'upgrade_clicks', v_clicks,
    'addons_approved', v_addons_approved,
    'subs_approved', v_subs_approved,
    'tenants_denied', v_tenants_denied,
    'tenants_converted', v_tenants_converted,
    'click_through_rate', CASE WHEN v_denials > 0 THEN round((v_clicks::numeric / v_denials) * 100, 1) ELSE 0 END,
    'conversion_rate', CASE WHEN v_tenants_denied > 0 THEN round((v_tenants_converted::numeric / v_tenants_denied) * 100, 1) ELSE 0 END,
    'by_reason', v_by_reason,
    'daily', v_daily,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.conversion_funnel_summary(int) TO authenticated;
