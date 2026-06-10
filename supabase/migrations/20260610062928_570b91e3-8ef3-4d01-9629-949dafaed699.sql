
-- auth_settings: restrict SELECT to superadmin
DROP POLICY IF EXISTS "any auth can read settings" ON public.auth_settings;
CREATE POLICY "superadmin reads settings" ON public.auth_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));

-- auth_login_events: restrict INSERT to service_role only
DROP POLICY IF EXISTS "service inserts events" ON public.auth_login_events;
CREATE POLICY "service inserts events" ON public.auth_login_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- einvoice_configs: restrict SELECT to owner/admin/manager
DROP POLICY IF EXISTS "einvoice_configs_select" ON public.einvoice_configs;
CREATE POLICY "einvoice_configs_select" ON public.einvoice_configs
  FOR SELECT
  USING (
    is_member_of(organization_id)
    AND org_role(organization_id) = ANY (ARRAY['owner'::text,'admin'::text,'manager'::text])
  );

-- tenant_wp_config: split ALL into restricted SELECT + write for owner/admin/superadmin
DROP POLICY IF EXISTS "tenant_wp_org" ON public.tenant_wp_config;
CREATE POLICY "tenant_wp_select" ON public.tenant_wp_config
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (is_member_of(organization_id)
        AND org_role(organization_id) = ANY (ARRAY['owner'::text,'admin'::text]))
  );
CREATE POLICY "tenant_wp_write" ON public.tenant_wp_config
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (is_member_of(organization_id)
        AND org_role(organization_id) = ANY (ARRAY['owner'::text,'admin'::text]))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (is_member_of(organization_id)
        AND org_role(organization_id) = ANY (ARRAY['owner'::text,'admin'::text]))
  );

-- Remove orders from realtime publication (leaks customer PII)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.orders';
  END IF;
END $$;
