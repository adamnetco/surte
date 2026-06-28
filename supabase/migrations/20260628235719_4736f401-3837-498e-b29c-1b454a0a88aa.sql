
CREATE TABLE IF NOT EXISTS public.api_key_usage (
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);
GRANT SELECT, INSERT, UPDATE ON public.api_key_usage TO service_role;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.api_key_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.api_key_consume(p_prefix text, p_hash text, p_max_per_min int DEFAULT 120)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key public.api_keys%rowtype;
  v_window timestamptz := date_trunc('minute', now());
  v_count int;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE prefix = p_prefix LIMIT 1;
  IF NOT FOUND OR v_key.key_hash <> p_hash THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key');
  END IF;
  IF v_key.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  INSERT INTO public.api_key_usage (api_key_id, window_start, count)
  VALUES (v_key.id, v_window, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET count = api_key_usage.count + 1
  RETURNING count INTO v_count;

  IF v_count > p_max_per_min THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'limit', p_max_per_min, 'remaining', 0,
      'reset_at', v_window + interval '1 minute');
  END IF;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_key.organization_id,
    'scopes', to_jsonb(v_key.scopes),
    'limit', p_max_per_min,
    'remaining', greatest(0, p_max_per_min - v_count),
    'reset_at', v_window + interval '1 minute'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.api_key_consume(text, text, int) TO service_role;
