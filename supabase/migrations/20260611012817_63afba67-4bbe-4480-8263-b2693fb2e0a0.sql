
-- Restrict LIST/SELECT via storage.objects API on public buckets while keeping direct public URL access working
-- Public URLs continue working because they're served by the storage CDN regardless of RLS,
-- but the listing API (storage.from('bucket').list()) will be restricted.

-- product-images: only admins/superadmins/editors can list
DROP POLICY IF EXISTS "product_images_public_list" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_list" ON storage.objects;
CREATE POLICY "product_images_admin_list"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role, 'admin'::public.app_role, 'editor'::public.app_role])
  );

-- desktop-releases: only admins/superadmins can list
DROP POLICY IF EXISTS "desktop_releases_public_list" ON storage.objects;
DROP POLICY IF EXISTS "desktop_releases_admin_list" ON storage.objects;
CREATE POLICY "desktop_releases_admin_list"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'desktop-releases'
    AND public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role, 'admin'::public.app_role])
  );
