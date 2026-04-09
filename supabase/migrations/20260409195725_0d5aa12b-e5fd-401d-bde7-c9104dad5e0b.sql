
-- Add editor policy to municipality_settings for consistency
CREATE POLICY "Editors can manage municipalities"
ON public.municipality_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));
