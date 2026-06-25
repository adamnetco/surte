
-- Fix 1: leads_trials — restrict to superadmin only (contains password_hash)
DROP POLICY IF EXISTS "leads admin all" ON public.leads_trials;
CREATE POLICY "leads superadmin all"
  ON public.leads_trials FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Fix 2: customer_reviews — scope admin/editor management by organization
DROP POLICY IF EXISTS "Admins can manage reviews" ON public.customer_reviews;

CREATE POLICY "Superadmins manage all reviews"
  ON public.customer_reviews FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Org members manage reviews in their org"
  ON public.customer_reviews FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND can_write_org(organization_id)
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'editor'::app_role])
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND can_write_org(organization_id)
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'editor'::app_role])
  );

-- Fix 3: orders — remove broad role disjunction that bypassed org scoping (Realtime PII leak)
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'superadmin'::app_role)
  );
-- Note: admin/editor/agent access continues via their own org-scoped or identity-scoped policies:
--   "Admins can manage all orders" (admin/superadmin), 
--   "Editors can view orders in their org" (org-scoped),
--   "Agents can view their orders" (agent_id = auth.uid()).
