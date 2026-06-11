
DROP POLICY IF EXISTS "any auth can read settings" ON public.auth_settings;
DROP POLICY IF EXISTS "superadmin reads settings" ON public.auth_settings;
CREATE POLICY "superadmin reads settings" ON public.auth_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.orders';
  END IF;
END $$;

DROP POLICY IF EXISTS "tenant_wp_org" ON public.tenant_wp_config;
DROP POLICY IF EXISTS "tenant_wp_select" ON public.tenant_wp_config;
DROP POLICY IF EXISTS "tenant_wp_select_admins" ON public.tenant_wp_config;
CREATE POLICY "tenant_wp_select_admins" ON public.tenant_wp_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.can_write_org(organization_id));

DROP POLICY IF EXISTS "einvoice_configs_select" ON public.einvoice_configs;
DROP POLICY IF EXISTS "einvoice_configs_select_admins" ON public.einvoice_configs;
CREATE POLICY "einvoice_configs_select_admins" ON public.einvoice_configs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.can_write_org(organization_id));

DROP POLICY IF EXISTS "service inserts events" ON public.auth_login_events;
DROP POLICY IF EXISTS "user inserts own login events" ON public.auth_login_events;
CREATE POLICY "user inserts own login events" ON public.auth_login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
