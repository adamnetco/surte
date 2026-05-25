-- sync_logs: auditoría centralizada de sincronizaciones
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  service_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','success','error','partial')),
  error_message text,
  payload jsonb DEFAULT '{}'::jsonb,
  attempts int NOT NULL DEFAULT 0,
  duration_ms int,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_logs_org_service_idx ON public.sync_logs (organization_id, service_name, last_run_at DESC);
CREATE INDEX IF NOT EXISTS sync_logs_status_idx ON public.sync_logs (status, last_run_at DESC);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_logs read by org members"
  ON public.sync_logs FOR SELECT
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.is_member_of(organization_id))
  );

CREATE POLICY "sync_logs superadmin all"
  ON public.sync_logs FOR ALL
  USING (public.is_master_superadmin(auth.uid()))
  WITH CHECK (public.is_master_superadmin(auth.uid()));

-- RPC: registrar/actualizar evento de sincronización
CREATE OR REPLACE FUNCTION public.log_sync_event(
  _log_id uuid,
  _organization_id uuid,
  _service_name text,
  _status text,
  _error_message text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb,
  _attempts int DEFAULT 0,
  _duration_ms int DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _status NOT IN ('pending','success','error','partial') THEN
    RAISE EXCEPTION 'invalid_status: %', _status;
  END IF;

  IF _log_id IS NULL THEN
    INSERT INTO public.sync_logs (organization_id, service_name, status, error_message, payload, attempts, duration_ms, last_run_at)
    VALUES (_organization_id, _service_name, _status, _error_message, COALESCE(_payload,'{}'::jsonb), COALESCE(_attempts,0), _duration_ms, now())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.sync_logs
       SET status = _status,
           error_message = COALESCE(_error_message, error_message),
           payload = COALESCE(_payload, payload),
           attempts = GREATEST(attempts, COALESCE(_attempts,0)),
           duration_ms = COALESCE(_duration_ms, duration_ms),
           last_run_at = now()
     WHERE id = _log_id
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      INSERT INTO public.sync_logs (id, organization_id, service_name, status, error_message, payload, attempts, duration_ms, last_run_at)
      VALUES (_log_id, _organization_id, _service_name, _status, _error_message, COALESCE(_payload,'{}'::jsonb), COALESCE(_attempts,0), _duration_ms, now())
      RETURNING id INTO v_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_sync_event(uuid, uuid, text, text, text, jsonb, int, int) TO authenticated, service_role;