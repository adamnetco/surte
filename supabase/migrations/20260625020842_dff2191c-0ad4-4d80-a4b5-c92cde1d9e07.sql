-- Phase 3/5 — Consolidar policies de saas_plans
-- Bug: la policy FOR ALL con has_role() se evalúa en SELECT para anon, que no tiene EXECUTE sobre has_role.
-- Solución: separar la policy de escritura en INSERT/UPDATE/DELETE explícitos.

DROP POLICY IF EXISTS plans_superadmin_write ON public.saas_plans;
DROP POLICY IF EXISTS plans_public_read ON public.saas_plans;

CREATE POLICY plans_public_read
  ON public.saas_plans
  FOR SELECT
  USING (is_public = true OR public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY plans_superadmin_insert
  ON public.saas_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY plans_superadmin_update
  ON public.saas_plans
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY plans_superadmin_delete
  ON public.saas_plans
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Asegurar GRANTs y EXECUTE
GRANT SELECT ON public.saas_plans TO anon, authenticated;
GRANT ALL ON public.saas_plans TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;