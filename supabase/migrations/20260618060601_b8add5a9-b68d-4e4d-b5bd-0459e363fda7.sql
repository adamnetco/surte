-- I2: RPC atómico para marcar un tenant_domain como primario dentro de su site
-- Evita el race condition de dos UPDATE separados desde el cliente.
CREATE OR REPLACE FUNCTION public.set_primary_tenant_domain(p_domain_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id uuid;
  v_org_id uuid;
BEGIN
  SELECT site_id, organization_id
    INTO v_site_id, v_org_id
  FROM public.tenant_domains
  WHERE id = p_domain_id;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'domain_not_found';
  END IF;

  -- Autorización: superadmin o miembro de la org dueña del sitio.
  IF NOT (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.tenant_domains
     SET is_primary = (id = p_domain_id),
         updated_at = now()
   WHERE site_id = v_site_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_primary_tenant_domain(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_tenant_domain(uuid) TO authenticated;