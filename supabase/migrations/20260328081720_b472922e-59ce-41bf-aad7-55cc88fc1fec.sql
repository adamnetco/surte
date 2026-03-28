-- Fix storage policies for product-images bucket
-- Drop existing restrictive policies and create permissive ones for admins
DO $$
BEGIN
  -- Drop all existing policies on storage.objects for product-images
  DROP POLICY IF EXISTS "Allow admin upload" ON storage.objects;
  DROP POLICY IF EXISTS "Allow admin update" ON storage.objects;
  DROP POLICY IF EXISTS "Allow admin delete" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
END $$;

-- Public read
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Admin/Editor insert
CREATE POLICY "product_images_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['admin','superadmin','editor']::public.app_role[])
  );

-- Admin/Editor update
CREATE POLICY "product_images_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['admin','superadmin','editor']::public.app_role[])
  );

-- Admin/Editor delete
CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['admin','superadmin','editor']::public.app_role[])
  );
