
CREATE OR REPLACE VIEW public.v_usage_counter_divergence AS
WITH real_counts AS (
  SELECT organization_id, 'max_products'::text AS limit_key,
         count(*) FILTER (WHERE COALESCE(is_active, true)) AS real_used
  FROM public.products GROUP BY organization_id
  UNION ALL
  SELECT organization_id, 'max_users', count(*) FILTER (WHERE COALESCE(is_active, true))
  FROM public.organization_members GROUP BY organization_id
  UNION ALL
  SELECT organization_id, 'max_locations', count(*) FILTER (WHERE COALESCE(is_active, true))
  FROM public.locations GROUP BY organization_id
)
SELECT
  c.organization_id,
  o.name AS organization_name,
  c.limit_key,
  c.used AS counter_used,
  COALESCE(r.real_used, 0) AS real_used,
  (c.used - COALESCE(r.real_used, 0)) AS drift,
  c.updated_at
FROM public.tenant_usage_counters c
LEFT JOIN real_counts r ON r.organization_id = c.organization_id AND r.limit_key = c.limit_key
LEFT JOIN public.organizations o ON o.id = c.organization_id
WHERE c.used <> COALESCE(r.real_used, 0);

GRANT SELECT ON public.v_usage_counter_divergence TO authenticated, service_role;
