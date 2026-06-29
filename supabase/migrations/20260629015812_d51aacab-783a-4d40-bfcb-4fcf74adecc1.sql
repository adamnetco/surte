
-- Normaliza el path a una plantilla simple (corta query y reemplaza UUIDs por :id)
CREATE OR REPLACE FUNCTION public.api_path_template(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(split_part(coalesce(p,''), '?', 1),
             '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':id', 'g'),
           '/[0-9]+(?=/|$)', '/:id', 'g'
         );
$$;

-- Vista materializada de métricas por hora
DROP MATERIALIZED VIEW IF EXISTS public.api_endpoint_metrics_hourly;
CREATE MATERIALIZED VIEW public.api_endpoint_metrics_hourly AS
SELECT
  organization_id,
  coalesce(mode, 'live')                                    AS mode,
  upper(coalesce(method,'GET'))                             AS method,
  public.api_path_template(path)                            AS endpoint,
  date_trunc('hour', created_at)                            AS bucket,
  count(*)                                                  AS req_count,
  count(*) FILTER (WHERE status_code >= 400)                AS err_count,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms)::int AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)::int AS p99_ms,
  avg(latency_ms)::int                                      AS avg_ms,
  max(latency_ms)                                           AS max_ms
FROM public.api_request_logs
WHERE created_at > now() - interval '60 days'
GROUP BY 1,2,3,4,5;

CREATE UNIQUE INDEX api_endpoint_metrics_hourly_pk
  ON public.api_endpoint_metrics_hourly (organization_id, mode, method, endpoint, bucket);
CREATE INDEX api_endpoint_metrics_hourly_org_bucket
  ON public.api_endpoint_metrics_hourly (organization_id, bucket DESC);

GRANT SELECT ON public.api_endpoint_metrics_hourly TO authenticated;
GRANT ALL    ON public.api_endpoint_metrics_hourly TO service_role;

-- Refresh seguro (concurrently)
CREATE OR REPLACE FUNCTION public.refresh_api_endpoint_metrics()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.api_endpoint_metrics_hourly;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_api_endpoint_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_api_endpoint_metrics() TO service_role;

-- Cron cada 5 minutos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-api-endpoint-metrics';
    PERFORM cron.schedule('refresh-api-endpoint-metrics', '*/5 * * * *',
      $cron$ SELECT public.refresh_api_endpoint_metrics(); $cron$);
  END IF;
END $$;

-- RPC para la UI (autorizado: admin/owner de la org, o superadmin)
CREATE OR REPLACE FUNCTION public.get_api_endpoint_metrics(
  p_org   uuid,
  p_from  timestamptz DEFAULT (now() - interval '24 hours'),
  p_to    timestamptz DEFAULT now(),
  p_mode  text        DEFAULT NULL
)
RETURNS TABLE (
  endpoint text, method text, mode text,
  req_count bigint, err_count bigint, err_rate numeric,
  p50_ms int, p95_ms int, p99_ms int, avg_ms int, max_ms int,
  buckets jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'superadmin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = p_org AND m.user_id = auth.uid()
        AND m.is_active = true AND m.role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.api_endpoint_metrics_hourly
    WHERE organization_id = p_org
      AND bucket >= date_trunc('hour', p_from)
      AND bucket <  date_trunc('hour', p_to) + interval '1 hour'
      AND (p_mode IS NULL OR mode = p_mode)
  )
  SELECT
    b.endpoint, b.method, b.mode,
    sum(b.req_count)::bigint AS req_count,
    sum(b.err_count)::bigint AS err_count,
    CASE WHEN sum(b.req_count) > 0
         THEN round(100.0 * sum(b.err_count) / sum(b.req_count), 2)
         ELSE 0 END AS err_rate,
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY b.p50_ms)::int,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY b.p95_ms)::int,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY b.p99_ms)::int,
    avg(b.avg_ms)::int,
    max(b.max_ms),
    jsonb_agg(jsonb_build_object('t', b.bucket, 'p95', b.p95_ms, 'req', b.req_count)
              ORDER BY b.bucket) AS buckets
  FROM base b
  GROUP BY b.endpoint, b.method, b.mode
  ORDER BY req_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_api_endpoint_metrics(uuid, timestamptz, timestamptz, text) TO authenticated;

-- Refresh inicial
SELECT public.refresh_api_endpoint_metrics();
