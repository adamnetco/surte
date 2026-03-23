CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));