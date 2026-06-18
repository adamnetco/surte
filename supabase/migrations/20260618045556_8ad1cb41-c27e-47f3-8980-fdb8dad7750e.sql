
-- Restrict raw read of feature_flags (tenant_ids leaks org UUIDs)
DROP POLICY IF EXISTS feature_flags_read_authenticated ON public.feature_flags;

CREATE POLICY feature_flags_read_superadmin
ON public.feature_flags
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Safe helper: returns whether a flag is enabled for a given tenant,
-- without exposing the tenant_ids array to the caller.
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_key text, _tenant_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        ff.enabled
        AND (
          ff.tenant_ids IS NULL
          OR array_length(ff.tenant_ids, 1) IS NULL
          OR (_tenant_id IS NOT NULL AND _tenant_id = ANY(ff.tenant_ids))
        )
      FROM public.feature_flags ff
      WHERE ff.key = _key
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid) TO authenticated, anon;
