
-- Ola 18 Slice 5: Superadmin dunning panel - global stats + admin RPCs

-- Global stats view
CREATE OR REPLACE VIEW public.v_dunning_global_kpis AS
SELECT
  COUNT(*) FILTER (WHERE status='open') AS open_cases,
  COUNT(*) FILTER (WHERE status='paused') AS paused_cases,
  COUNT(*) FILTER (WHERE status='recovered') AS recovered_cases,
  COUNT(*) FILTER (WHERE status='written_off') AS written_off_cases,
  COUNT(*) FILTER (WHERE status='canceled_nonpayment') AS canceled_cases,
  COALESCE(SUM(total_amount_cop) FILTER (WHERE status='open'), 0) AS mrr_at_risk_cop,
  COALESCE(SUM(total_amount_cop) FILTER (WHERE status='recovered' AND closed_at > now() - interval '30 days'), 0) AS recovered_30d_cop,
  COALESCE(SUM(total_amount_cop) FILTER (WHERE status IN ('written_off','canceled_nonpayment') AND closed_at > now() - interval '30 days'), 0) AS lost_30d_cop,
  CASE
    WHEN COUNT(*) FILTER (WHERE closed_at > now() - interval '30 days' AND status IN ('recovered','written_off','canceled_nonpayment')) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(*) FILTER (WHERE status='recovered' AND closed_at > now() - interval '30 days')::numeric
      / NULLIF(COUNT(*) FILTER (WHERE closed_at > now() - interval '30 days' AND status IN ('recovered','written_off','canceled_nonpayment')), 0),
      2
    )
  END AS recovery_rate_30d_pct
FROM public.dunning_cases;

GRANT SELECT ON public.v_dunning_global_kpis TO authenticated;

-- Daily cohort
CREATE OR REPLACE VIEW public.v_dunning_daily AS
SELECT
  date_trunc('day', opened_at)::date AS day,
  COUNT(*) AS opened,
  COUNT(*) FILTER (WHERE status='recovered') AS recovered,
  COUNT(*) FILTER (WHERE status IN ('written_off','canceled_nonpayment')) AS lost,
  COALESCE(SUM(total_amount_cop), 0) AS amount_cop
FROM public.dunning_cases
WHERE opened_at > now() - interval '60 days'
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON public.v_dunning_daily TO authenticated;

-- Force retry: schedule next_retry_at = now, reset to open
CREATE OR REPLACE FUNCTION public.dunning_force_retry(p_case_id UUID)
RETURNS public.dunning_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.dunning_cases;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden: superadmin only';
  END IF;

  UPDATE public.dunning_cases
  SET status = 'open',
      next_retry_at = now(),
      closed_at = NULL,
      updated_at = now(),
      metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('forced_retry_by', auth.uid(), 'forced_retry_at', now())
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO public.dunning_events (organization_id, status, message, metadata)
  VALUES (v_case.organization_id, 'retry', 'Forced retry by superadmin', jsonb_build_object('case_id', p_case_id, 'actor', auth.uid()));

  RETURN v_case;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dunning_force_retry(UUID) TO authenticated;

-- Write-off: mark as written_off, close
CREATE OR REPLACE FUNCTION public.dunning_write_off(p_case_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS public.dunning_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.dunning_cases;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden: superadmin only';
  END IF;

  UPDATE public.dunning_cases
  SET status = 'written_off',
      closed_at = now(),
      next_retry_at = NULL,
      updated_at = now(),
      metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('write_off_by', auth.uid(), 'write_off_reason', p_reason, 'write_off_at', now())
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO public.dunning_events (organization_id, status, message, metadata)
  VALUES (v_case.organization_id, 'written_off', COALESCE(p_reason, 'Written off by superadmin'), jsonb_build_object('case_id', p_case_id, 'actor', auth.uid()));

  RETURN v_case;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dunning_write_off(UUID, TEXT) TO authenticated;

-- Extend grace period by N days
CREATE OR REPLACE FUNCTION public.dunning_extend_grace(p_case_id UUID, p_extra_days INT)
RETURNS public.dunning_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.dunning_cases;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden: superadmin only';
  END IF;
  IF p_extra_days IS NULL OR p_extra_days <= 0 OR p_extra_days > 60 THEN
    RAISE EXCEPTION 'invalid extra_days: must be 1..60';
  END IF;

  UPDATE public.dunning_cases
  SET grace_until = COALESCE(grace_until, now()) + (p_extra_days || ' days')::interval,
      updated_at = now(),
      metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('grace_extended_by', auth.uid(), 'grace_extended_days', p_extra_days, 'grace_extended_at', now())
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO public.dunning_events (organization_id, status, message, metadata)
  VALUES (v_case.organization_id, 'grace_extended', format('Grace extended by %s days', p_extra_days), jsonb_build_object('case_id', p_case_id, 'actor', auth.uid()));

  RETURN v_case;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dunning_extend_grace(UUID, INT) TO authenticated;
