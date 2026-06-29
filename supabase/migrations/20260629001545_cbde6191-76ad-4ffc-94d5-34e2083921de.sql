-- Ola 23 — Slice 6: Alertas automáticas (webhook caído / spike 5xx / API key cerca límite)

-- 1) Tabla de alertas
CREATE TABLE IF NOT EXISTS public.api_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('webhook_down','api_5xx_spike','api_key_near_limit')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  subject_id uuid,
  subject_label text,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_alerts_org_status_idx ON public.api_alerts(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS api_alerts_kind_subject_open_idx ON public.api_alerts(kind, subject_id) WHERE status = 'open';

GRANT SELECT, UPDATE ON public.api_alerts TO authenticated;
GRANT ALL ON public.api_alerts TO service_role;

ALTER TABLE public.api_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read api_alerts" ON public.api_alerts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = api_alerts.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "org admins ack api_alerts" ON public.api_alerts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = api_alerts.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
  WITH CHECK (true);

CREATE TRIGGER api_alerts_set_updated_at
  BEFORE UPDATE ON public.api_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) RPC evaluador idempotente. Crea/actualiza alertas según señales recientes.
CREATE OR REPLACE FUNCTION public.evaluate_api_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created int := 0;
  v_resolved int := 0;
  r record;
BEGIN
  -- A) Webhook caído: endpoint activo con >=5 deliveries y todas fallidas en 15 min
  FOR r IN
    SELECT we.organization_id, we.id AS endpoint_id, we.url,
           COUNT(*) FILTER (WHERE wd.status = 'failed') AS failed,
           COUNT(*) AS total
    FROM public.webhook_endpoints we
    JOIN public.webhook_deliveries wd
      ON wd.endpoint_id = we.id
     AND wd.created_at > now() - interval '15 minutes'
    WHERE we.is_active = true
    GROUP BY we.organization_id, we.id, we.url
    HAVING COUNT(*) >= 5 AND COUNT(*) FILTER (WHERE wd.status = 'failed') = COUNT(*)
  LOOP
    INSERT INTO public.api_alerts(organization_id, kind, severity, subject_id, subject_label, message, metadata)
    SELECT r.organization_id, 'webhook_down', 'critical', r.endpoint_id, r.url,
           format('Webhook %s falló en las últimas %s entregas (15 min).', r.url, r.total),
           jsonb_build_object('failed', r.failed, 'total', r.total, 'window_min', 15)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.api_alerts a
      WHERE a.kind = 'webhook_down' AND a.subject_id = r.endpoint_id AND a.status = 'open'
    );
    GET DIAGNOSTICS v_created = ROW_COUNT;
  END LOOP;

  -- Resolver webhook_down si en últimos 15 min hubo al menos 1 success
  UPDATE public.api_alerts a
     SET status = 'resolved', resolved_at = now()
   WHERE a.kind = 'webhook_down' AND a.status = 'open'
     AND EXISTS (
       SELECT 1 FROM public.webhook_deliveries wd
       WHERE wd.endpoint_id = a.subject_id
         AND wd.status = 'success'
         AND wd.created_at > now() - interval '15 minutes'
     );

  -- B) Spike 5xx en API pública: >=10 requests y >=20% con status >= 500 en última hora por org
  FOR r IN
    SELECT organization_id,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status_code >= 500) AS errors
    FROM public.api_request_logs
    WHERE created_at > now() - interval '60 minutes'
    GROUP BY organization_id
    HAVING COUNT(*) >= 10
       AND COUNT(*) FILTER (WHERE status_code >= 500)::numeric / COUNT(*) >= 0.20
  LOOP
    INSERT INTO public.api_alerts(organization_id, kind, severity, subject_label, message, metadata)
    SELECT r.organization_id, 'api_5xx_spike', 'warning', 'public-api',
           format('Tasa de errores 5xx %.0f%% (%s/%s) en última hora.',
                  (r.errors::numeric / r.total) * 100, r.errors, r.total),
           jsonb_build_object('errors', r.errors, 'total', r.total, 'window_min', 60)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.api_alerts a
      WHERE a.kind = 'api_5xx_spike' AND a.organization_id = r.organization_id AND a.status = 'open'
    );
  END LOOP;

  -- C) API key cerca de límite: uso del minuto actual >= 80% del rate_limit_per_min
  FOR r IN
    SELECT k.organization_id, k.id AS key_id, k.name, k.rate_limit_per_min, u.count
    FROM public.api_keys k
    JOIN public.api_key_usage u ON u.api_key_id = k.id
    WHERE k.is_active = true
      AND k.rate_limit_per_min > 0
      AND u.bucket_minute = date_trunc('minute', now())
      AND u.count::numeric / k.rate_limit_per_min >= 0.80
  LOOP
    INSERT INTO public.api_alerts(organization_id, kind, severity, subject_id, subject_label, message, metadata)
    SELECT r.organization_id, 'api_key_near_limit', 'warning', r.key_id, r.name,
           format('API key "%s" en %s/%s req/min (≥80%% del límite).', r.name, r.count, r.rate_limit_per_min),
           jsonb_build_object('count', r.count, 'limit', r.rate_limit_per_min)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.api_alerts a
      WHERE a.kind = 'api_key_near_limit' AND a.subject_id = r.key_id AND a.status = 'open'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'evaluated_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_api_alerts() TO authenticated, service_role;

-- 3) RPC ack/resolve
CREATE OR REPLACE FUNCTION public.api_alert_ack(_id uuid, _resolve boolean DEFAULT false)
RETURNS public.api_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.api_alerts;
BEGIN
  UPDATE public.api_alerts
     SET status = CASE WHEN _resolve THEN 'resolved' ELSE 'acknowledged' END,
         acknowledged_by = auth.uid(),
         acknowledged_at = COALESCE(acknowledged_at, now()),
         resolved_at = CASE WHEN _resolve THEN now() ELSE resolved_at END
   WHERE id = _id
     AND (
       public.has_role(auth.uid(), 'superadmin'::app_role)
       OR EXISTS (
         SELECT 1 FROM public.organization_members m
         WHERE m.organization_id = api_alerts.organization_id
           AND m.user_id = auth.uid()
           AND m.role IN ('owner','admin')
       )
     )
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'alert not found or insufficient privileges';
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_alert_ack(uuid, boolean) TO authenticated;

-- 4) pg_cron evaluación cada 5 minutos
SELECT cron.schedule(
  'evaluate_api_alerts_every_5min',
  '*/5 * * * *',
  $$ SELECT public.evaluate_api_alerts(); $$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evaluate_api_alerts_every_5min');
