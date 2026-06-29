DROP POLICY IF EXISTS "cash_arqueo_org_read" ON storage.objects;
CREATE POLICY "cash_arqueo_org_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cash-arqueo'
    AND (storage.foldername(name))[1] IN (
      SELECT ('org-' || organization_id::text) FROM public.organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "cash_arqueo_org_write" ON storage.objects;
CREATE POLICY "cash_arqueo_org_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cash-arqueo'
    AND (storage.foldername(name))[1] IN (
      SELECT ('org-' || organization_id::text) FROM public.organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );