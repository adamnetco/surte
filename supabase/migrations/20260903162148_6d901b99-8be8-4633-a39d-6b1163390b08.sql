CREATE TABLE public.tiendaplus_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_url text NOT NULL DEFAULT 'https://tiendasysbopos.lovable.app',
  api_key text,
  api_key_prefix text,
  scopes text[] NOT NULL DEFAULT '{}',
  remote_company_id text,
  company_name text,
  currency_code text,
  enabled boolean NOT NULL DEFAULT false,
  exposed boolean NOT NULL DEFAULT false,
  allow_owner_manage boolean NOT NULL DEFAULT false,
  sync_catalog boolean NOT NULL DEFAULT true,
  sync_orders boolean NOT NULL DEFAULT true,
  sync_payments boolean NOT NULL DEFAULT true,
  orders_cursor timestamptz,
  catalog_cursor timestamptz,
  last_ping_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tiendaplus_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'push',
  entity text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  items integer NOT NULL DEFAULT 0,
  ok_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiendaplus_sync_log_org_created
  ON public.tiendaplus_sync_log (organization_id, created_at DESC);

GRANT SELECT (
  id, organization_id, base_url, api_key_prefix, scopes, remote_company_id,
  company_name, currency_code, enabled, exposed, allow_owner_manage,
  sync_catalog, sync_orders, sync_payments, orders_cursor, catalog_cursor,
  last_ping_at, last_sync_at, last_error, created_at, updated_at
) ON public.tiendaplus_connections TO authenticated;
GRANT ALL ON public.tiendaplus_connections TO service_role;

GRANT SELECT ON public.tiendaplus_sync_log TO authenticated;
GRANT ALL ON public.tiendaplus_sync_log TO service_role;

ALTER TABLE public.tiendaplus_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiendaplus_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiendaplus_conn_read_org"
  ON public.tiendaplus_connections FOR SELECT TO authenticated
  USING (public.can_write_org(organization_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "tiendaplus_log_read_org"
  ON public.tiendaplus_sync_log FOR SELECT TO authenticated
  USING (public.can_write_org(organization_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_tiendaplus_conn_updated_at
  BEFORE UPDATE ON public.tiendaplus_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();