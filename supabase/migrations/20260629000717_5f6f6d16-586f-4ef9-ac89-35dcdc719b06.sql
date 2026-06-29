
CREATE TABLE public.api_request_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  key_prefix TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INT NOT NULL,
  latency_ms INT,
  ip TEXT,
  user_agent TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_request_logs_org_created_idx ON public.api_request_logs (organization_id, created_at DESC);
CREATE INDEX api_request_logs_key_created_idx ON public.api_request_logs (api_key_id, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read logs" ON public.api_request_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = api_request_logs.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin')
  )
  OR public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "service writes logs" ON public.api_request_logs
FOR INSERT TO service_role WITH CHECK (true);

-- KPI RPC: usage summary last N days per key
CREATE OR REPLACE FUNCTION public.api_key_usage_stats(p_org UUID, p_days INT DEFAULT 7)
RETURNS TABLE (
  api_key_id UUID,
  name TEXT,
  prefix TEXT,
  total_requests BIGINT,
  errors BIGINT,
  p50_latency_ms NUMERIC,
  p95_latency_ms NUMERIC,
  last_used_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    k.id,
    k.name,
    k.prefix,
    COUNT(l.*)::BIGINT AS total_requests,
    COUNT(l.*) FILTER (WHERE l.status_code >= 400)::BIGINT AS errors,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY l.latency_ms) AS p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY l.latency_ms) AS p95,
    MAX(l.created_at) AS last_used_at
  FROM public.api_keys k
  LEFT JOIN public.api_request_logs l
    ON l.api_key_id = k.id
   AND l.created_at >= now() - (p_days || ' days')::INTERVAL
  WHERE k.organization_id = p_org
    AND (
      public.has_role(auth.uid(), 'superadmin')
      OR EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.organization_id = p_org AND m.user_id = auth.uid()
          AND m.role IN ('owner','admin')
      )
    )
  GROUP BY k.id, k.name, k.prefix
  ORDER BY total_requests DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.api_key_usage_stats(UUID, INT) TO authenticated;
