CREATE OR REPLACE FUNCTION public.cash_session_compute_denom_hash(p_session_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(
    extensions.digest(
      convert_to(
        coalesce(
          string_agg(
            c.denomination_id::text || ':' || c.quantity::text || ':' || c.kind,
            '|'
            ORDER BY c.denomination_id::text, c.kind
          ),
          ''
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  FROM public.cash_session_counts c
  WHERE c.session_id = p_session_id;
$$;

GRANT EXECUTE ON FUNCTION public.cash_session_compute_denom_hash(uuid) TO authenticated;