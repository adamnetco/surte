ALTER FUNCTION public.api_key_ip_allowed(text[], inet) SET search_path = public;
ALTER FUNCTION public.api_path_template(text) SET search_path = public;
ALTER FUNCTION public.fiscal_adj_log_immutable() SET search_path = public;
ALTER FUNCTION public.nps_category(integer) SET search_path = public;
ALTER FUNCTION public.pos_void_log_immutable() SET search_path = public;
ALTER FUNCTION public.tg_lifecycle_enrollments_touch() SET search_path = public;

REVOKE SELECT ON public.api_endpoint_metrics_hourly FROM anon, authenticated;

ALTER VIEW public.v_lifecycle_daily_30d SET (security_invoker = true);
ALTER VIEW public.v_lifecycle_suppression_30d SET (security_invoker = true);
ALTER VIEW public.v_lifecycle_kpis_30d SET (security_invoker = true);
ALTER VIEW public.v_lifecycle_ab_30d SET (security_invoker = true);
ALTER VIEW public.v_dunning_global_kpis SET (security_invoker = true);
ALTER VIEW public.v_dunning_daily SET (security_invoker = true);
ALTER VIEW public.v_dunning_summary SET (security_invoker = true);
ALTER VIEW public.v_usage_counter_divergence SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.is_valid_public_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id
      AND o.is_active = true
      AND o.deleted_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.is_active_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org_id
      AND m.user_id = auth.uid()
      AND m.is_active = true
  )
$$;

DROP POLICY IF EXISTS "Anon can create reviews without PII" ON public.customer_reviews;
CREATE POLICY "Anon can create reviews without PII"
ON public.customer_reviews FOR INSERT
WITH CHECK (
  customer_name IS NOT NULL
  AND comment IS NOT NULL
  AND rating >= 1 AND rating <= 5
  AND customer_phone IS NULL
  AND customer_email IS NULL
  AND organization_id IS NOT NULL
  AND public.is_valid_public_org(organization_id)
);

DROP POLICY IF EXISTS "Authenticated can create reviews" ON public.customer_reviews;
CREATE POLICY "Authenticated can create reviews"
ON public.customer_reviews FOR INSERT
WITH CHECK (
  customer_name IS NOT NULL
  AND comment IS NOT NULL
  AND rating >= 1 AND rating <= 5
  AND organization_id IS NOT NULL
  AND public.is_valid_public_org(organization_id)
);

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (
  customer_name IS NOT NULL
  AND customer_phone IS NOT NULL
  AND total > 0
  AND organization_id IS NOT NULL
  AND public.is_valid_public_org(organization_id)
);

DROP POLICY IF EXISTS "Agents can create orders" ON public.orders;
CREATE POLICY "Agents can create orders"
ON public.orders FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'agente'::app_role)
  AND organization_id IS NOT NULL
  AND public.is_active_org_member(organization_id)
);