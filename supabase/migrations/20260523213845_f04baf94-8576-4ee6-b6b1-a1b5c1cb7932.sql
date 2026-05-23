-- Extend tenant_wp_config
ALTER TABLE public.tenant_wp_config
  ADD COLUMN IF NOT EXISTS revalidate_url text,
  ADD COLUMN IF NOT EXISTS revalidate_token text,
  ADD COLUMN IF NOT EXISTS wp_app_user text,
  ADD COLUMN IF NOT EXISTS wp_app_password text,
  ADD COLUMN IF NOT EXISTS product_cpt text DEFAULT 'producto',
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

-- Sync log
CREATE TABLE IF NOT EXISTS public.tenant_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.tenant_sites(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('products','revalidate','dns_verify')),
  status text NOT NULL DEFAULT 'pending',
  total int DEFAULT 0,
  succeeded int DEFAULT 0,
  failed int DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_sync_log_site ON public.tenant_sync_log(site_id, created_at DESC);
ALTER TABLE public.tenant_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read sync log" ON public.tenant_sync_log;
CREATE POLICY "members read sync log" ON public.tenant_sync_log
  FOR SELECT USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "members insert sync log" ON public.tenant_sync_log;
CREATE POLICY "members insert sync log" ON public.tenant_sync_log
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));