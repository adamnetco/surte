
-- Add SEO columns to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;

-- Add SEO columns and slug to brands
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;

-- Populate brand slugs from existing names
UPDATE public.brands SET slug = lower(regexp_replace(name, '\s+', '-', 'g')) WHERE slug IS NULL;
