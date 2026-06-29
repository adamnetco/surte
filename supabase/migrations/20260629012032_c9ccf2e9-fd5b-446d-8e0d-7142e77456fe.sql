-- Slice 1: Per-IP rate limit + IP allowlist on API keys

-- 1. IP allowlist column on api_keys (CIDR list, NULL = any IP allowed)
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS allowed_ips text[] DEFAULT NULL;

COMMENT ON COLUMN public.api_keys.allowed_ips IS
  'Optional list of CIDR ranges or exact IPs allowed to use this key. NULL = unrestricted.';

-- 2. Per-IP sliding bucket (independent from per-key bucket)
CREATE TABLE IF NOT EXISTS public.api_ip_rate (
  ip            inet      NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer   NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, window_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_ip_rate TO service_role;
ALTER TABLE public.api_ip_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role manages ip rate"
  ON public.api_ip_rate FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS api_ip_rate_window_idx
  ON public.api_ip_rate (window_start);

-- 3. RPC: atomic check-and-increment per IP (600 req / 60s default)
CREATE OR REPLACE FUNCTION public.api_ip_consume(
  p_ip inet,
  p_limit integer DEFAULT 600,
  p_window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count  integer;
BEGIN
  v_window := date_trunc('minute', now())
              + ((extract(second FROM now())::int / p_window_seconds)::int
                 * (p_window_seconds || ' seconds')::interval);

  INSERT INTO public.api_ip_rate (ip, window_start, count)
    VALUES (p_ip, v_window, 1)
  ON CONFLICT (ip, window_start)
    DO UPDATE SET count = api_ip_rate.count + 1
  RETURNING count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'limit', p_limit,
    'reset_at', v_window + (p_window_seconds || ' seconds')::interval
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_ip_consume(inet, integer, integer) TO service_role;

-- 4. Helper: check if IP matches allowlist
CREATE OR REPLACE FUNCTION public.api_key_ip_allowed(
  p_allowed text[],
  p_ip inet
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_entry text;
BEGIN
  IF p_allowed IS NULL OR cardinality(p_allowed) = 0 THEN
    RETURN true;
  END IF;
  IF p_ip IS NULL THEN
    RETURN false;
  END IF;
  FOREACH v_entry IN ARRAY p_allowed LOOP
    BEGIN
      IF p_ip <<= v_entry::inet OR p_ip = v_entry::inet THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
  END LOOP;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_key_ip_allowed(text[], inet) TO service_role, authenticated;

-- 5. Daily cleanup of old IP rate windows (> 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_api_ip_rate()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.api_ip_rate
   WHERE window_start < now() - interval '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_api_ip_rate() TO service_role;