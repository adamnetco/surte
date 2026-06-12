-- Tighten custom_scripts write access: only admin and superadmin can manage.
-- Editors can no longer insert/update/delete custom scripts (XSS prevention).
DROP POLICY IF EXISTS "Admins manage scripts" ON public.custom_scripts;

CREATE POLICY "Admins manage scripts"
ON public.custom_scripts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));