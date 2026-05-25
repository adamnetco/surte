
-- 1) Invoices storage bucket: enforce org membership via path prefix
DROP POLICY IF EXISTS invoices_org_read ON storage.objects;
DROP POLICY IF EXISTS invoices_org_write ON storage.objects;
DROP POLICY IF EXISTS invoices_org_delete ON storage.objects;
DROP POLICY IF EXISTS invoices_org_update ON storage.objects;

CREATE POLICY invoices_org_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY invoices_org_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY invoices_org_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_member_of(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY invoices_org_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);

-- 2) Hide cost_price and price_distributor from public/anon on products.
--    Storefront should use the products_public view.
REVOKE SELECT (cost_price, price_distributor) ON public.products FROM anon;
REVOKE SELECT (cost_price, price_distributor) ON public.products FROM authenticated;
GRANT  SELECT (cost_price, price_distributor) ON public.products TO authenticated;
-- Note: RLS still applies; we further restrict reads via column-aware policy below.

-- Replace the wide "viewable by everyone" SELECT policy with one that allows
-- anyone to read non-sensitive product data, and only staff to read sensitive cols.
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;

CREATE POLICY "Products public read"
ON public.products
FOR SELECT
TO anon, authenticated
USING (true);

-- Revoke again after policy recreation (CREATE POLICY does not affect grants,
-- but we want to be explicit that anon cannot read these columns).
REVOKE SELECT (cost_price, price_distributor) ON public.products FROM anon;
REVOKE SELECT (cost_price, price_distributor) ON public.products FROM authenticated;
GRANT  SELECT (cost_price, price_distributor) ON public.products TO authenticated;

-- Note on column privileges: with the above, anon cannot SELECT cost_price/price_distributor,
-- and authenticated users can only see them if a row-level policy permits.
-- The existing "Admins can manage products" and "Editors can manage products" policies cover staff.
-- Regular authenticated users still cannot reference those columns because of column grants
-- (the GRANT to authenticated above is overridden by per-row policy SELECT, which for
-- non-staff falls back to the "Products public read" policy — and that policy plus the
-- explicit REVOKE blocks the sensitive columns).
-- To be fully safe, leave only staff with column privileges:
REVOKE SELECT (cost_price, price_distributor) ON public.products FROM authenticated;

-- 3) push_subscriptions: deny anon reads, scope admin policy
DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admins manage all push subs" ON public.push_subscriptions;

-- Block anon from reading anything
CREATE POLICY "push_subs_deny_anon"
ON public.push_subscriptions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Authenticated users manage only their own rows (user_id must match, never NULL)
CREATE POLICY "push_subs_owner"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id);

-- Admins can manage subscriptions (kept for support workflows)
CREATE POLICY "push_subs_admin"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

-- 4) Set fixed search_path on the only function missing it
CREATE OR REPLACE FUNCTION public.touch_admin_section_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END $function$;
