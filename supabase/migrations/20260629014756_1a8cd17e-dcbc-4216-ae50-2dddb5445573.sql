
-- ===== Ola 24-bis · Slice 4: Rotación + expiración + alertas pre-expiry =====

-- 1) Columnas de linaje y tracking de notificaciones
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS rotated_from_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rotated_to_key_id   uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expiry_notified_stages text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at
  ON public.api_keys(expires_at)
  WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

-- 2) Fix bug slice 3: la columna es key_hash (no hash). Recreamos la RPC.
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
   WHERE prefix = p_prefix AND key_hash = p_hash AND revoked_at IS NULL
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
      'scopes', v_key.scopes, 'mode', v_key.mode,
      'limit', p_max_per_min, 'remaining', 0,
      'reset_at', v_window_start + interval '1 minute'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_key.organization_id,
    'scopes', v_key.scopes, 'mode', v_key.mode,
    'limit', p_max_per_min,
    'remaining', p_max_per_min - v_count,
    'reset_at', v_window_start + interval '1 minute'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.api_key_consume(text, text, integer) TO anon, authenticated, service_role;

-- 3) Rotación: crea key nueva, programa expiración con grace en la vieja
CREATE OR REPLACE FUNCTION public.api_key_rotate(
  p_id uuid,
  p_grace_days integer DEFAULT 7,
  p_new_name text DEFAULT NULL,
  p_expires_in_days integer DEFAULT 365
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.api_keys%ROWTYPE;
  v_new_id uuid;
  v_secret text;
  v_prefix text;
  v_hash text;
  v_grace timestamptz;
  v_is_admin boolean;
BEGIN
  SELECT * INTO v_old FROM public.api_keys WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'api_key_not_found';
  END IF;

  -- Solo admin/owner de la org puede rotar
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE organization_id = v_old.organization_id
       AND user_id = auth.uid()
       AND is_active = true
       AND role IN ('owner','admin')
  ) INTO v_is_admin;
  IF NOT v_is_admin AND NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_old.rotated_to_key_id IS NOT NULL THEN
    RAISE EXCEPTION 'already_rotated';
  END IF;

  -- Genera secreto + prefix (formato sk_{mode}_{12} secret 32)
  v_prefix := 'sk_' || v_old.mode || '_' || substr(encode(gen_random_bytes(8),'hex'), 1, 12);
  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');
  v_grace := now() + make_interval(days => greatest(0, coalesce(p_grace_days,7)));

  INSERT INTO public.api_keys(
    organization_id, name, prefix, key_hash, scopes, created_by,
    expires_at, mode, allowed_ips, rotated_from_key_id
  )
  VALUES (
    v_old.organization_id,
    coalesce(p_new_name, v_old.name || ' (rotated)'),
    v_prefix, v_hash, v_old.scopes, auth.uid(),
    now() + make_interval(days => greatest(1, coalesce(p_expires_in_days, 365))),
    v_old.mode, v_old.allowed_ips, v_old.id
  )
  RETURNING id INTO v_new_id;

  UPDATE public.api_keys
     SET expires_at = v_grace,
         rotated_to_key_id = v_new_id,
         updated_at = now()
   WHERE id = v_old.id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_key_id', v_new_id,
    'new_token', v_prefix || '_' || v_secret,
    'old_key_id', v_old.id,
    'old_grace_until', v_grace
  );
END $$;

GRANT EXECUTE ON FUNCTION public.api_key_rotate(uuid, integer, text, integer) TO authenticated;

-- 4) Listado para notifier: keys que entran a una etapa T-14/T-7/T-1
CREATE OR REPLACE FUNCTION public.api_keys_due_for_expiry_notice()
RETURNS TABLE(
  id uuid, organization_id uuid, name text, prefix text, mode text,
  expires_at timestamptz, days_left integer, stage text,
  already_notified text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT k.id, k.organization_id, k.name, k.prefix, k.mode,
           k.expires_at,
           ceil(extract(epoch from (k.expires_at - now()))/86400)::int AS days_left,
           k.expiry_notified_stages
      FROM public.api_keys k
     WHERE k.revoked_at IS NULL
       AND k.expires_at IS NOT NULL
       AND k.expires_at > now()
       AND k.expires_at < now() + interval '15 days'
  )
  SELECT id, organization_id, name, prefix, mode, expires_at, days_left,
         CASE
           WHEN days_left <= 1  AND NOT ('T-1'  = ANY(expiry_notified_stages)) THEN 'T-1'
           WHEN days_left <= 7  AND NOT ('T-7'  = ANY(expiry_notified_stages)) THEN 'T-7'
           WHEN days_left <= 14 AND NOT ('T-14' = ANY(expiry_notified_stages)) THEN 'T-14'
         END AS stage,
         expiry_notified_stages
    FROM base
   WHERE (days_left <= 1  AND NOT ('T-1'  = ANY(expiry_notified_stages)))
      OR (days_left <= 7  AND NOT ('T-7'  = ANY(expiry_notified_stages)))
      OR (days_left <= 14 AND NOT ('T-14' = ANY(expiry_notified_stages)));
$$;

GRANT EXECUTE ON FUNCTION public.api_keys_due_for_expiry_notice() TO service_role;

CREATE OR REPLACE FUNCTION public.api_key_mark_expiry_notified(p_id uuid, p_stage text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys
     SET expiry_notified_stages = array_append(expiry_notified_stages, p_stage),
         updated_at = now()
   WHERE id = p_id AND NOT (p_stage = ANY(expiry_notified_stages));
$$;

GRANT EXECUTE ON FUNCTION public.api_key_mark_expiry_notified(uuid, text) TO service_role;
