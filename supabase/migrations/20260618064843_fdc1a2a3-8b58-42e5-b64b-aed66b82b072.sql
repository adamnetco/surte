-- POS-tenant-keypair-parity: per-tenant Ed25519 signing material on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS signing_public_key text,
  ADD COLUMN IF NOT EXISTS signing_private_key_encrypted text,
  ADD COLUMN IF NOT EXISTS signing_key_id text,
  ADD COLUMN IF NOT EXISTS signing_key_created_at timestamptz;

COMMENT ON COLUMN public.organizations.signing_public_key IS 'Ed25519 public key (raw bytes, base64) used to verify tenant-signed artifacts (SSO handoff, webhooks).';
COMMENT ON COLUMN public.organizations.signing_private_key_encrypted IS 'Ed25519 private key (PKCS8) encrypted with AUTH_ENCRYPTION_KEY (AES-GCM, same format as encryptSecret).';
COMMENT ON COLUMN public.organizations.signing_key_id IS 'UUID identifying the current keypair; rotate by changing this id.';
