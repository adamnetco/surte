
CREATE OR REPLACE FUNCTION public.check_api_latency_alerts(
  p_threshold_ms int DEFAULT 1500,
  p_min_requests int DEFAULT 50
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      organization_id, mode, method, endpoint,
      sum(req_count)::bigint AS req,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY p95_ms)::int AS p95
    FROM public.api_endpoint_metrics_hourly
    WHERE bucket >= date_trunc('hour', now() - interval '1 hour')
    GROUP BY organization_id, mode, method, endpoint
    HAVING sum(req_count) >= p_min_requests
       AND percentile_cont(0.95) WITHIN GROUP (ORDER BY p95_ms) > p_threshold_ms
  LOOP
    -- Dedupe: ¿ya hay alerta abierta para este endpoint/modo en las últimas 24h?
    IF EXISTS (
      SELECT 1 FROM public.api_alerts a
      WHERE a.organization_id = r.organization_id
        AND a.kind = 'latency_p95'
        AND a.status = 'open'
        AND a.mode = r.mode
        AND a.subject_label = r.method || ' ' || r.endpoint
        AND a.created_at > now() - interval '24 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.api_alerts (organization_id, kind, severity, subject_label, message, mode, metadata)
    VALUES (
      r.organization_id, 'latency_p95',
      CASE WHEN r.p95 > p_threshold_ms * 2 THEN 'critical' ELSE 'warning' END,
      r.method || ' ' || r.endpoint,
      format('p95 de %s ms en %s %s (modo %s) sobre %s requests en la última hora',
             r.p95, r.method, r.endpoint, r.mode, r.req),
      r.mode,
      jsonb_build_object('p95_ms', r.p95, 'requests', r.req, 'threshold_ms', p_threshold_ms)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_latency_alerts(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_latency_alerts(int, int) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'check-api-latency-alerts';
    PERFORM cron.schedule('check-api-latency-alerts', '*/10 * * * *',
      $cron$ SELECT public.check_api_latency_alerts(); $cron$);
  END IF;
END $$;
