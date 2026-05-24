
-- Volvemos al patrón table+column grants (más simple y sin SECURITY DEFINER view)
DROP VIEW IF EXISTS public.public_customer_reviews;

-- Re-creamos la política pública de lectura
CREATE POLICY "Approved reviews are public"
ON public.customer_reviews
FOR SELECT TO anon, authenticated
USING (is_approved = true AND is_active = true);

-- Revocar acceso a columnas PII para anon y authenticated
REVOKE SELECT (customer_email, customer_phone) ON public.customer_reviews FROM anon, authenticated;

-- Garantizar SELECT sobre el resto de columnas a anon y authenticated
GRANT SELECT
  (id, order_id, customer_name, rating, comment, is_approved, is_active,
   admin_response, created_at, updated_at, organization_id)
ON public.customer_reviews TO anon, authenticated;
