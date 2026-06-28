
CREATE OR REPLACE FUNCTION public.get_survey_benchmarks_by_plan(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_since timestamptz := now() - make_interval(days => p_days);
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH resp AS (
    SELECT
      sr.id,
      sr.score,
      sr.created_at,
      sc.type AS campaign_type,
      COALESCE(p.code, 'sin_plan') AS plan_code,
      COALESCE(p.name, 'Sin plan') AS plan_name
    FROM public.survey_responses sr
    JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
    LEFT JOIN public.survey_invites si ON si.id = sr.invite_id
    LEFT JOIN public.organizations o ON o.id = si.organization_id
    LEFT JOIN public.subscriptions s ON s.organization_id = o.id AND s.status IN ('active','trialing','past_due')
    LEFT JOIN public.saas_plans p ON p.id = s.plan_id
    WHERE sr.created_at >= v_since
  ),
  agg AS (
    SELECT
      plan_code,
      plan_name,
      COUNT(*) FILTER (WHERE campaign_type = 'nps') AS nps_responses,
      COUNT(*) FILTER (WHERE campaign_type = 'nps' AND score >= 9) AS promoters,
      COUNT(*) FILTER (WHERE campaign_type = 'nps' AND score BETWEEN 7 AND 8) AS passives,
      COUNT(*) FILTER (WHERE campaign_type = 'nps' AND score <= 6) AS detractors,
      COUNT(*) FILTER (WHERE campaign_type = 'csat') AS csat_responses,
      AVG(score) FILTER (WHERE campaign_type = 'csat') AS csat_avg
    FROM resp
    GROUP BY plan_code, plan_name
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'plan_code', plan_code,
      'plan_name', plan_name,
      'nps_responses', nps_responses,
      'promoters', promoters,
      'passives', passives,
      'detractors', detractors,
      'nps_score', CASE WHEN nps_responses > 0
        THEN ROUND(((promoters - detractors)::numeric / nps_responses) * 100, 1)
        ELSE NULL END,
      'csat_responses', csat_responses,
      'csat_avg', CASE WHEN csat_responses > 0 THEN ROUND(csat_avg::numeric, 2) ELSE NULL END
    )
    ORDER BY (promoters + passives + detractors + csat_responses) DESC
  )
  INTO v_result
  FROM agg;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_survey_benchmarks_by_plan(integer) TO authenticated;
