ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
ALTER TABLE public.api_request_logs ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';
ALTER TABLE public.api_alerts ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

CREATE INDEX IF NOT EXISTS idx_api_request_logs_org_mode_created ON public.api_request_logs(organization_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_mode ON public.api_keys(organization_id, mode);

DROP FUNCTION IF EXISTS public.api_key_consume(text, text, integer);

CREATE OR REPLACE FUNCTION public.api_key_consume(p_prefix text, p_hash text, p_max_per_min integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key public.api_keys%ROWTYPE;
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('minute', v_now);
  v_count integer;
BEGIN
  SELECT * INTO v_key FROM public.api_keys
   WHERE prefix = p_prefix AND hash = p_hash AND revoked_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  INSERT INTO public.api_key_usage(api_key_id, window_start, count)
  VALUES (v_key.id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET count = public.api_key_usage.count + 1
  RETURNING count INTO v_count;

  UPDATE public.api_keys SET last_used_at = v_now WHERE id = v_key.id;

  IF v_count > p_max_per_min THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'rate_limited',
      'organization_id', v_key.organization_id,
      'scopes', v_key.scopes,
      'mode', v_key.mode,
      'limit', p_max_per_min,
      'remaining', 0,
      'reset_at', v_window_start + interval '1 minute'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_key.organization_id,
    'scopes', v_key.scopes,
    'mode', v_key.mode,
    'limit', p_max_per_min,
    'remaining', p_max_per_min - v_count,
    'reset_at', v_window_start + interval '1 minute'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.api_key_consume(text, text, integer) TO anon, authenticated, service_role;