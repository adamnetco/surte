-- 1. Columnas Cloudflare en tenant_domains (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant_domains') THEN
    ALTER TABLE public.tenant_domains
      ADD COLUMN IF NOT EXISTS dns_mode TEXT NOT NULL DEFAULT 'saas'
        CHECK (dns_mode IN ('saas','cloudflare_account','manual')),
      ADD COLUMN IF NOT EXISTS cf_zone_id TEXT,
      ADD COLUMN IF NOT EXISTS cf_account_id UUID,
      ADD COLUMN IF NOT EXISTS cf_hostname_id TEXT,
      ADD COLUMN IF NOT EXISTS cf_status TEXT,
      ADD COLUMN IF NOT EXISTS cf_ssl_status TEXT,
      ADD COLUMN IF NOT EXISTS cf_dcv_method TEXT DEFAULT 'txt',
      ADD COLUMN IF NOT EXISTS cf_ownership_verification JSONB,
      ADD COLUMN IF NOT EXISTS cname_target TEXT,
      ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. tenant_cloudflare_accounts
CREATE TABLE IF NOT EXISTS public.tenant_cloudflare_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  label TEXT NOT NULL,
  cf_account_id TEXT NOT NULL,
  cf_zone_id TEXT,
  api_token_encrypted TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_cloudflare_accounts TO authenticated;
GRANT ALL ON public.tenant_cloudflare_accounts TO service_role;
ALTER TABLE public.tenant_cloudflare_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members manage cf accounts" ON public.tenant_cloudflare_accounts;
CREATE POLICY "org members manage cf accounts"
  ON public.tenant_cloudflare_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_cf_accounts_one_default_per_org
  ON public.tenant_cloudflare_accounts(organization_id) WHERE is_default;

DROP TRIGGER IF EXISTS tg_cf_accounts_set_updated_at ON public.tenant_cloudflare_accounts;
CREATE TRIGGER tg_cf_accounts_set_updated_at
  BEFORE UPDATE ON public.tenant_cloudflare_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();