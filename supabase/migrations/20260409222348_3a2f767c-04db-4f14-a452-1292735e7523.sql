
ALTER TABLE public.municipality_settings
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS meta_title text,
ADD COLUMN IF NOT EXISTS meta_description text,
ADD COLUMN IF NOT EXISTS og_image_url text;

-- Add unique constraint on slug for clean URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_municipality_settings_slug ON public.municipality_settings(slug);
