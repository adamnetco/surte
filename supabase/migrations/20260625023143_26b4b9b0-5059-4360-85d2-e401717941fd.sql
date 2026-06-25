
-- catalog_templates: restrict read to authenticated
DROP POLICY IF EXISTS tpl_read_active ON public.catalog_templates;
CREATE POLICY tpl_read_active
  ON public.catalog_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'superadmin'::app_role));

REVOKE SELECT ON public.catalog_templates FROM anon;

-- catalog_template_items: restrict read to authenticated
DROP POLICY IF EXISTS tpl_items_read_active ON public.catalog_template_items;
CREATE POLICY tpl_items_read_active
  ON public.catalog_template_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.catalog_templates t
    WHERE t.id = catalog_template_items.template_id
      AND (t.is_active = true OR has_role(auth.uid(), 'superadmin'::app_role))
  ));

REVOKE SELECT ON public.catalog_template_items FROM anon;

-- custom_scripts: restrict read to authenticated (rendering happens server-side)
DROP POLICY IF EXISTS "Active scripts readable by all" ON public.custom_scripts;
CREATE POLICY "Active scripts readable by authenticated"
  ON public.custom_scripts FOR SELECT
  TO authenticated
  USING (is_active = true);

REVOKE SELECT ON public.custom_scripts FROM anon;
