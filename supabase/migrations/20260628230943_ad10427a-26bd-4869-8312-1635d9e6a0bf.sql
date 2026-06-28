
CREATE OR REPLACE FUNCTION public.get_survey_analytics(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_since timestamptz := now() - make_interval(days => greatest(p_days, 1));
  v_kpis jsonb;
  v_campaigns jsonb;
  v_detractors jsonb;
  v_trend jsonb;
BEGIN
  SELECT public.has_role(auth.uid(), 'superadmin'::app_role) INTO v_is_super;
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH r AS (
    SELECT sr.*, sc.type, sc.code
    FROM public.survey_responses sr
    JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
    WHERE sr.created_at >= v_since
  ),
  inv AS (
    SELECT campaign_id, count(*) AS shown
    FROM public.survey_invites
    WHERE shown_at >= v_since
    GROUP BY campaign_id
  ),
  nps AS (
    SELECT
      count(*) FILTER (WHERE type='nps') AS nps_responses,
      count(*) FILTER (WHERE type='nps' AND score >= 9) AS promoters,
      count(*) FILTER (WHERE type='nps' AND score BETWEEN 7 AND 8) AS passives,
      count(*) FILTER (WHERE type='nps' AND score <= 6) AS detractors,
      count(*) FILTER (WHERE type='csat') AS csat_responses,
      avg(score) FILTER (WHERE type='csat') AS csat_avg,
      count(*) AS total
    FROM r
  )
  SELECT jsonb_build_object(
    'nps_score', CASE WHEN nps_responses > 0
       THEN round(((promoters::numeric - detractors::numeric) / nps_responses::numeric) * 100, 1)
       ELSE NULL END,
    'nps_responses', nps_responses,
    'promoters', promoters,
    'passives', passives,
    'detractors', detractors,
    'csat_avg', round(coalesce(csat_avg, 0)::numeric, 2),
    'csat_responses', csat_responses,
    'total_responses', total
  ) INTO v_kpis FROM nps;

  SELECT coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) INTO v_campaigns
  FROM (
    SELECT sc.code, sc.name, sc.type, sc.is_active,
      coalesce(inv.shown, 0) AS shown,
      coalesce(rc.responses, 0) AS responses,
      CASE WHEN coalesce(inv.shown,0) > 0
        THEN round(coalesce(rc.responses,0)::numeric / inv.shown::numeric * 100, 1)
        ELSE 0 END AS response_rate,
      rc.avg_score
    FROM public.survey_campaigns sc
    LEFT JOIN inv ON inv.campaign_id = sc.id
    LEFT JOIN (
      SELECT campaign_id, count(*) AS responses, round(avg(score)::numeric, 2) AS avg_score
      FROM r GROUP BY campaign_id
    ) rc ON rc.campaign_id = sc.id
    ORDER BY sc.is_active DESC, sc.name
  ) c;

  SELECT coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb) INTO v_detractors
  FROM (
    SELECT sr.id, sr.score, sr.comment, sr.created_at,
           sc.code AS campaign_code, sc.name AS campaign_name,
           o.name AS org_name, sr.org_id
    FROM public.survey_responses sr
    JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
    LEFT JOIN public.organizations o ON o.id = sr.org_id
    WHERE sr.created_at >= v_since
      AND ((sc.type='nps' AND sr.score <= 6) OR (sc.type='csat' AND sr.score <= 2))
    ORDER BY sr.created_at DESC
    LIMIT 50
  ) d;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'day')), '[]'::jsonb) INTO v_trend
  FROM (
    SELECT date_trunc('day', sr.created_at)::date AS day,
           count(*) FILTER (WHERE sc.type='nps') AS nps_count,
           round(avg(sr.score) FILTER (WHERE sc.type='csat')::numeric, 2) AS csat_avg,
           CASE WHEN count(*) FILTER (WHERE sc.type='nps') > 0 THEN
             round(((count(*) FILTER (WHERE sc.type='nps' AND sr.score>=9)::numeric
                   - count(*) FILTER (WHERE sc.type='nps' AND sr.score<=6)::numeric)
                   / count(*) FILTER (WHERE sc.type='nps')::numeric) * 100, 1)
           ELSE NULL END AS nps_score
    FROM public.survey_responses sr
    JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
    WHERE sr.created_at >= v_since
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'campaigns', v_campaigns,
    'detractors', v_detractors,
    'trend', v_trend,
    'since', v_since
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_survey_analytics(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_survey_analytics(integer) TO authenticated;
