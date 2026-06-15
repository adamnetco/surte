ALTER TABLE public.tenant_domains
  ADD COLUMN IF NOT EXISTS cf_ssl_validation_records jsonb;

COMMENT ON COLUMN public.tenant_domains.cf_ssl_validation_records IS
  'Cloudflare ssl.validation_records[] (TXT _acme-challenge.* y/o HTTP tokens) para que el cliente publique los DCV y se emita el certificado.';