DROP POLICY IF EXISTS einvoice_configs_write ON public.einvoice_configs;
CREATE POLICY einvoice_configs_write ON public.einvoice_configs
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'superadmin'::app_role)
  OR (is_member_of(organization_id) AND org_role(organization_id) = ANY (ARRAY['owner','admin','manager']))
)
WITH CHECK (
  has_role(auth.uid(), 'superadmin'::app_role)
  OR (is_member_of(organization_id) AND org_role(organization_id) = ANY (ARRAY['owner','admin','manager']))
);