
-- 1) einvoice_configs: restringir SELECT a superadmin u owner/admin
DROP POLICY IF EXISTS einvoice_configs_select_admins ON public.einvoice_configs;
CREATE POLICY einvoice_configs_select_admins
ON public.einvoice_configs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'superadmin'::app_role)
  OR (is_member_of(organization_id) AND org_role(organization_id) IN ('owner','admin'))
);

-- 2) tenant_wp_config: restringir SELECT a superadmin u owner/admin
DROP POLICY IF EXISTS tenant_wp_select_admins ON public.tenant_wp_config;
CREATE POLICY tenant_wp_select_admins
ON public.tenant_wp_config
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'superadmin'::app_role)
  OR (is_member_of(organization_id) AND org_role(organization_id) IN ('owner','admin'))
);

-- 3) realtime.messages: restringir suscripciones por topic
DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;

CREATE POLICY "Scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Canal por usuario: solo el dueño
  (realtime.topic() = 'user:' || auth.uid()::text)
  -- Canales scoping por organización
  OR (realtime.topic() LIKE 'health_events:%'
      AND is_member_of((split_part(realtime.topic(), ':', 2))::uuid))
  OR (realtime.topic() LIKE 'print_jobs_%'
      AND is_member_of((substring(realtime.topic() from 12))::uuid))
  -- Canales con token/id opacos (UUIDs no enumerables)
  OR realtime.topic() LIKE 'persistent_cart:%'
  OR realtime.topic() LIKE 'order-%'
  OR realtime.topic() LIKE 'ticket-%'
  OR realtime.topic() LIKE 'table-%'
  -- Canales globales (los datos los protege RLS de las tablas subyacentes)
  OR realtime.topic() IN (
    'kds-realtime',
    'mesas-realtime',
    'admin-orders-realtime',
    'my-orders-realtime',
    'sync_monitor',
    'sync_logs_dash',
    'sync_outbox_dlq'
  )
);
