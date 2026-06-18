-- POS-tenant-keypair-parity — backfill keypair for tenants created before parity
--
-- This SQL does NOT generate keys (Ed25519 requires WebCrypto, lives in edge fn).
-- Instead it lists organizations that need backfill, and the operator runs the
-- `backfill-tenant-keys` edge function (or invokes ensureTenantKeypair per org).
--
-- 1) Inventory: how many tenants miss a keypair?
SELECT
  COUNT(*) FILTER (WHERE signing_public_key IS NULL) AS missing,
  COUNT(*) FILTER (WHERE signing_public_key IS NOT NULL) AS ok,
  COUNT(*) AS total
FROM public.organizations;

-- 2) List the missing ones (most recent first) so the edge function can iterate:
SELECT id, slug, name, created_at
FROM public.organizations
WHERE signing_public_key IS NULL
ORDER BY created_at DESC;

-- 3) After running the backfill via edge function, verify parity:
--    expected: missing = 0, ok = total
SELECT
  COUNT(*) FILTER (WHERE signing_public_key IS NULL) AS still_missing,
  COUNT(*) AS total
FROM public.organizations;
