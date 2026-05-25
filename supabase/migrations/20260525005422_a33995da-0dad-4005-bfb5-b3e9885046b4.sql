CREATE OR REPLACE FUNCTION public.get_recent_sync_logs(
  _services text[] DEFAULT NULL,
  _limit    int    DEFAULT 50
) RETURNS TABLE (
  id uuid,
  organization_id uuid,
  service_name text,
  status text,
  error_message text,
  attempts int,
  duration_ms int,
  payload jsonb,
  last_run_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT l.*
    FROM public.sync_logs l
    WHERE (_services IS NULL OR l.service_name = ANY(_services))
      AND (
        public.is_master_superadmin(auth.uid())
        OR (l.organization_id IS NOT NULL AND public.is_member_of(l.organization_id))
      )
  ),
  ranked AS (
    SELECT v.*,
           row_number() OVER (PARTITION BY v.service_name ORDER BY v.last_run_at DESC) AS rn
    FROM visible v
  )
  SELECT id, organization_id, service_name, status, error_message,
         attempts, duration_ms, payload, last_run_at
  FROM ranked
  WHERE rn = 1
  ORDER BY last_run_at DESC
  LIMIT GREATEST(1, COALESCE(_limit, 50));
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_sync_logs(text[], int) TO authenticated, service_role;