DROP POLICY IF EXISTS "Admins can manage featured sections" ON public.featured_sections;

CREATE POLICY "Admins and superadmins can manage featured sections"
ON public.featured_sections
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins and superadmins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));