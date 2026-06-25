-- Fix: anon no puede evaluar has_role (no tiene EXECUTE). Separamos en dos policies OR-eadas.
DROP POLICY IF EXISTS plans_public_read ON public.saas_plans;

CREATE POLICY plans_public_read
  ON public.saas_plans
  FOR SELECT
  USING (is_public = true);

CREATE POLICY plans_superadmin_read_all
  ON public.saas_plans
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));