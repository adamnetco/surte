
-- Add unit pricing columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_quantity numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit_measure text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS net_weight_grams numeric DEFAULT NULL;

-- Fix landing_pages RLS: allow superadmin too
DROP POLICY IF EXISTS "Admins can manage landing pages" ON public.landing_pages;
CREATE POLICY "Admins can manage landing pages"
  ON public.landing_pages FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

-- Allow editors to manage landing pages too
CREATE POLICY "Editors can manage landing pages"
  ON public.landing_pages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role));
