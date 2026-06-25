-- Phase 3 — Diagnóstico RLS: función security definer que devuelve estado RLS/GRANT/políticas por tabla pública
CREATE OR REPLACE FUNCTION public.audit_public_rls()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Solo superadmin puede ejecutar
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: superadmin required';
  END IF;

  WITH tables AS (
    SELECT c.oid, c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  grants AS (
    SELECT t.table_name,
      jsonb_object_agg(role, privs) FILTER (WHERE role IS NOT NULL) AS by_role
    FROM tables t
    LEFT JOIN LATERAL (
      SELECT grantee AS role, jsonb_agg(DISTINCT privilege_type ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = t.table_name
        AND grantee IN ('anon','authenticated','service_role')
      GROUP BY grantee
    ) g ON true
    GROUP BY t.table_name
  ),
  policies AS (
    SELECT t.table_name,
      jsonb_agg(jsonb_build_object(
        'name', p.polname,
        'cmd', CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text END,
        'roles', (SELECT jsonb_agg(rolname) FROM pg_roles r WHERE r.oid = ANY(p.polroles)),
        'qual', pg_get_expr(p.polqual, p.polrelid),
        'check', pg_get_expr(p.polwithcheck, p.polrelid)
      )) FILTER (WHERE p.polname IS NOT NULL) AS items,
      COUNT(p.polname) AS count
    FROM tables t
    LEFT JOIN pg_policy p ON p.polrelid = t.oid
    GROUP BY t.table_name
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'tables', jsonb_agg(jsonb_build_object(
      'name', t.table_name,
      'rls_enabled', t.rls_enabled,
      'rls_forced', t.rls_forced,
      'grants', COALESCE(g.by_role, '{}'::jsonb),
      'policy_count', COALESCE(p.count, 0),
      'policies', COALESCE(p.items, '[]'::jsonb)
    ) ORDER BY t.table_name)
  )
  INTO result
  FROM tables t
  LEFT JOIN grants g ON g.table_name = t.table_name
  LEFT JOIN policies p ON p.table_name = t.table_name;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_public_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_public_rls() TO authenticated;

COMMENT ON FUNCTION public.audit_public_rls() IS 'Devuelve estado RLS, GRANTs (anon/authenticated/service_role) y políticas de cada tabla en public. Solo superadmin.';