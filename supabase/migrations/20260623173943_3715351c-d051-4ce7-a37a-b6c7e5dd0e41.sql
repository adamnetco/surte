
-- 1) customer_reviews: anon INSERT no puede traer phone/email
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.customer_reviews;
CREATE POLICY "Anon can create reviews without PII"
  ON public.customer_reviews
  FOR INSERT
  TO anon
  WITH CHECK (
    customer_name IS NOT NULL
    AND comment IS NOT NULL
    AND rating BETWEEN 1 AND 5
    AND customer_phone IS NULL
    AND customer_email IS NULL
  );
CREATE POLICY "Authenticated can create reviews"
  ON public.customer_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_name IS NOT NULL
    AND comment IS NOT NULL
    AND rating BETWEEN 1 AND 5
  );

-- 2) leads_trials: ocultar password_hash al API
REVOKE SELECT (password_hash) ON public.leads_trials FROM authenticated, anon;

-- 3) notification_subscriptions: eliminar INSERT anónimo
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.notification_subscriptions;
CREATE POLICY "Authenticated users can subscribe themselves"
  ON public.notification_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND phone IS NOT NULL
    AND length(regexp_replace(phone, '\D', '', 'g')) >= 10
  );

-- 4) push_subscriptions: ocultar claves criptográficas al API
REVOKE SELECT (auth, p256dh) ON public.push_subscriptions FROM authenticated, anon;

-- 5) orders: editores limitados a sus organizaciones
DROP POLICY IF EXISTS "Editors can view orders" ON public.orders;
DROP POLICY IF EXISTS "Editors can update orders" ON public.orders;
CREATE POLICY "Editors can view orders in their org"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'editor'::app_role)
    AND organization_id IS NOT NULL
    AND can_write_org(organization_id)
  );
CREATE POLICY "Editors can update orders in their org"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'editor'::app_role)
    AND organization_id IS NOT NULL
    AND can_write_org(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'editor'::app_role)
    AND organization_id IS NOT NULL
    AND can_write_org(organization_id)
  );
