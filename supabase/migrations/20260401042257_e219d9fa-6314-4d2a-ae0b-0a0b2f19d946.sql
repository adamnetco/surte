
-- Hero slides table for dynamic city-targeted carousel
CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  image_mobile_url TEXT,
  cta_text TEXT DEFAULT 'Ver Catálogo',
  cta_link TEXT DEFAULT '/catalogo',
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero slides viewable by everyone" ON public.hero_slides FOR SELECT USING (true);
CREATE POLICY "Admins can manage hero slides" ON public.hero_slides FOR ALL USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role])
) WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role])
);

-- Add SEO fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS gtin TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'InStock';

-- Add SEO settings fields
INSERT INTO public.app_settings (key, value) VALUES
  ('seo_site_name', 'SURTÉ YA - Soluciones Alimenticias'),
  ('seo_default_description', 'Salsas, cárnicos y pulpas al mayor en Bucaramanga. Directo de fábrica a tu negocio.'),
  ('seo_google_merchant_id', ''),
  ('seo_facebook_pixel_id', ''),
  ('seo_facebook_catalog_id', ''),
  ('social_facebook', ''),
  ('social_instagram', ''),
  ('social_tiktok', '')
ON CONFLICT (key) DO NOTHING;
