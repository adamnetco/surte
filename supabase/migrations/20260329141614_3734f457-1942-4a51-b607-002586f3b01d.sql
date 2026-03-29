-- Allow editors to manage gallery
CREATE POLICY "Editors can manage gallery"
ON public.gallery FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to manage brands  
CREATE POLICY "Editors can manage brands"
ON public.brands FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to manage banners
CREATE POLICY "Editors can manage banners"
ON public.banners FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to manage app_settings
CREATE POLICY "Editors can manage settings"
ON public.app_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));