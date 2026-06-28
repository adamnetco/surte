
-- Slice 4: Acciones desde detractores
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.client_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS csm_alerted_at timestamptz;

-- RPC: crear ticket de soporte desde una respuesta detractora
CREATE OR REPLACE FUNCTION public.survey_create_detractor_ticket(p_response_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp record;
  v_camp_name text;
  v_org_name text;
  v_ticket_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT sr.*, sc.name AS campaign_name
  INTO v_resp
  FROM public.survey_responses sr
  LEFT JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
  WHERE sr.id = p_response_id;

  IF v_resp IS NULL THEN
    RAISE EXCEPTION 'response_not_found';
  END IF;

  IF v_resp.ticket_id IS NOT NULL THEN
    RETURN v_resp.ticket_id;
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_resp.org_id;
  v_camp_name := COALESCE(v_resp.campaign_name, 'Encuesta');

  INSERT INTO public.client_tickets (user_id, subject, category, priority, status, description)
  VALUES (
    v_resp.user_id,
    'Detractor NPS/CSAT (' || v_resp.score || ') - ' || COALESCE(v_org_name, 'Org'),
    'csm_detractor',
    'high',
    'open',
    'Respuesta de ' || v_camp_name || E'\nScore: ' || v_resp.score ||
    E'\nFecha: ' || to_char(v_resp.created_at, 'YYYY-MM-DD HH24:MI') ||
    E'\nComentario: ' || COALESCE(v_resp.comment, '(sin comentario)')
  )
  RETURNING id INTO v_ticket_id;

  UPDATE public.survey_responses SET ticket_id = v_ticket_id WHERE id = p_response_id;

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.survey_create_detractor_ticket(uuid) TO authenticated;

-- RPC: marcar que ya alertamos al CSM
CREATE OR REPLACE FUNCTION public.survey_mark_csm_alerted(p_response_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.survey_responses
    SET csm_alerted_at = now()
    WHERE id = p_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.survey_mark_csm_alerted(uuid) TO authenticated;

-- Extender get_survey_analytics para exponer ticket_id y csm_alerted_at en detractores
CREATE OR REPLACE FUNCTION public.get_survey_analytics(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := now() - (p_days || ' days')::interval;
  v_kpis jsonb;
  v_campaigns jsonb;
  v_detractors jsonb;
  v_nps_total int;
  v_promoters int;
  v_passives int;
  v_detractors_n int;
  v_nps_score numeric;
  v_csat_avg numeric;
  v_csat_responses int;
  v_total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE sc.type = 'nps'),
    COUNT(*) FILTER (WHERE sc.type = 'nps' AND sr.score >= 9),
    COUNT(*) FILTER (WHERE sc.type = 'nps' AND sr.score BETWEEN 7 AND 8),
    COUNT(*) FILTER (WHERE sc.type = 'nps' AND sr.score <= 6),
    COALESCE(ROUND(AVG(sr.score) FILTER (WHERE sc.type = 'csat')::numeric, 2), 0),
    COUNT(*) FILTER (WHERE sc.type = 'csat'),
    COUNT(*)
  INTO v_nps_total, v_promoters, v_passives, v_detractors_n, v_csat_avg, v_csat_responses, v_total
  FROM public.survey_responses sr
  JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
  WHERE sr.created_at >= v_from;

  v_nps_score := CASE WHEN v_nps_total > 0
    THEN ROUND(((v_promoters - v_detractors_n)::numeric / v_nps_total) * 100, 0)
    ELSE NULL END;

  v_kpis := jsonb_build_object(
    'nps_score', v_nps_score,
    'nps_responses', v_nps_total,
    'promoters', v_promoters,
    'passives', v_passives,
    'detractors', v_detractors_n,
    'csat_avg', v_csat_avg,
    'csat_responses', v_csat_responses,
    'total_responses', v_total
  );

  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'name'), '[]'::jsonb) INTO v_campaigns
  FROM (
    SELECT jsonb_build_object(
      'code', sc.code,
      'name', sc.name,
      'type', sc.type,
      'is_active', sc.is_active,
      'shown', (SELECT COUNT(*) FROM public.survey_invites si WHERE si.campaign_id = sc.id AND si.shown_at >= v_from),
      'responses', (SELECT COUNT(*) FROM public.survey_responses sr WHERE sr.campaign_id = sc.id AND sr.created_at >= v_from),
      'response_rate', CASE WHEN (SELECT COUNT(*) FROM public.survey_invites si WHERE si.campaign_id = sc.id AND si.shown_at >= v_from) > 0
        THEN ROUND(((SELECT COUNT(*) FROM public.survey_responses sr WHERE sr.campaign_id = sc.id AND sr.created_at >= v_from))::numeric * 100 /
          (SELECT COUNT(*) FROM public.survey_invites si WHERE si.campaign_id = sc.id AND si.shown_at >= v_from), 1)
        ELSE 0 END,
      'avg_score', (SELECT ROUND(AVG(score)::numeric, 2) FROM public.survey_responses sr WHERE sr.campaign_id = sc.id AND sr.created_at >= v_from)
    ) AS c
    FROM public.survey_campaigns sc
    WHERE sc.is_active = true
  ) s;

  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'created_at' DESC), '[]'::jsonb) INTO v_detractors
  FROM (
    SELECT jsonb_build_object(
      'id', sr.id,
      'score', sr.score,
      'comment', sr.comment,
      'created_at', sr.created_at,
      'campaign_code', sc.code,
      'campaign_name', sc.name,
      'org_name', o.name,
      'org_id', sr.org_id,
      'ticket_id', sr.ticket_id,
      'csm_alerted_at', sr.csm_alerted_at,
      'user_id', sr.user_id
    ) AS d
    FROM public.survey_responses sr
    JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
    LEFT JOIN public.organizations o ON o.id = sr.org_id
    WHERE sr.created_at >= v_from
      AND ((sc.type = 'nps' AND sr.score <= 6) OR (sc.type = 'csat' AND sr.score <= 2))
    ORDER BY sr.created_at DESC
    LIMIT 50
  ) s;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'campaigns', v_campaigns,
    'detractors', v_detractors
  );
END;
$$;
