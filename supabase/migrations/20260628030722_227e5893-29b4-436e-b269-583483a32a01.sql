
CREATE OR REPLACE VIEW public.v_lifecycle_kpis_30d AS
SELECT
  COUNT(*) FILTER (WHERE e.enrolled_at >= now() - interval '30 days') AS enrollments_30d,
  COUNT(*) FILTER (WHERE e.status = 'active') AS active,
  COUNT(*) FILTER (WHERE e.status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE e.status = 'suppressed') AS suppressed_enroll,
  COUNT(*) FILTER (WHERE e.status = 'failed') AS failed_enroll,
  (SELECT COUNT(*) FROM public.lifecycle_sends s WHERE s.sent_at >= now() - interval '30 days' AND s.status = 'sent') AS sends_sent_30d,
  (SELECT COUNT(*) FROM public.lifecycle_sends s WHERE s.sent_at >= now() - interval '30 days' AND s.status = 'failed') AS sends_failed_30d,
  (SELECT COUNT(*) FROM public.lifecycle_sends s WHERE s.sent_at >= now() - interval '30 days' AND s.status = 'suppressed') AS sends_suppressed_30d
FROM public.lifecycle_enrollments e;

CREATE OR REPLACE VIEW public.v_lifecycle_by_sequence_30d AS
SELECT
  e.sequence::text AS sequence,
  COUNT(DISTINCT e.id) AS enrollments,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') AS completed,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') AS active,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'failed') AS failed_enroll,
  COALESCE((SELECT COUNT(*) FROM public.lifecycle_sends s WHERE s.sequence = e.sequence AND s.status='sent' AND s.sent_at >= now() - interval '30 days'), 0) AS sent,
  COALESCE((SELECT COUNT(*) FROM public.lifecycle_sends s WHERE s.sequence = e.sequence AND s.status='failed' AND s.sent_at >= now() - interval '30 days'), 0) AS failed,
  COALESCE((SELECT COUNT(*) FROM public.lifecycle_sends s WHERE s.sequence = e.sequence AND s.status='suppressed' AND s.sent_at >= now() - interval '30 days'), 0) AS suppressed
FROM public.lifecycle_enrollments e
WHERE e.enrolled_at >= now() - interval '30 days'
GROUP BY e.sequence;

CREATE OR REPLACE VIEW public.v_lifecycle_daily_30d AS
SELECT
  date_trunc('day', s.sent_at)::date AS day,
  s.sequence::text AS sequence,
  COUNT(*) FILTER (WHERE s.status='sent') AS sent,
  COUNT(*) FILTER (WHERE s.status='failed') AS failed,
  COUNT(*) FILTER (WHERE s.status='suppressed') AS suppressed
FROM public.lifecycle_sends s
WHERE s.sent_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1;

REVOKE ALL ON public.v_lifecycle_kpis_30d FROM PUBLIC, anon;
REVOKE ALL ON public.v_lifecycle_by_sequence_30d FROM PUBLIC, anon;
REVOKE ALL ON public.v_lifecycle_daily_30d FROM PUBLIC, anon;
GRANT SELECT ON public.v_lifecycle_kpis_30d TO authenticated, service_role;
GRANT SELECT ON public.v_lifecycle_by_sequence_30d TO authenticated, service_role;
GRANT SELECT ON public.v_lifecycle_daily_30d TO authenticated, service_role;
