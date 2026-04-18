-- Create a public-facing view that excludes sensitive business data (cost_price, price_distributor, price_wholesale)
-- Only admins/superadmins should see margin data via direct table access

CREATE OR REPLACE VIEW public.products_public AS
SELECT
  id,
  name,
  description,
  price,
  original_price,
  image_url,
  category_id,
  stock,
  unit,
  is_fresh,
  is_wholesale,
  is_active,
  created_at,
  updated_at,
  slug,
  meta_title,
  meta_description,
  brand,
  sku,
  gtin,
  weight,
  availability,
  tags,
  unit_quantity,
  unit_measure,
  net_weight_grams,
  base_unit
FROM public.products
WHERE is_active = true;

-- Grant read access to the view for anonymous and authenticated users
GRANT SELECT ON public.products_public TO anon, authenticated;

-- Restrict direct cost_price column access on products table.
-- Revoke broad column access from anon/authenticated and re-grant explicit columns excluding cost_price.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;

-- Re-grant SELECT on safe columns only for anon/authenticated
GRANT SELECT (
  id, name, description, price, original_price, image_url, category_id,
  stock, unit, is_fresh, is_wholesale, is_active, created_at, updated_at,
  slug, meta_title, meta_description, brand, sku, gtin, weight, availability,
  tags, unit_quantity, unit_measure, net_weight_grams, base_unit
) ON public.products TO anon, authenticated;

-- cost_price, price_wholesale, price_distributor remain accessible only to roles
-- that have full table privileges (service_role) or via RLS policies for admins.
-- The "Admins can manage products" RLS policy already allows admins/superadmins full access.

COMMENT ON VIEW public.products_public IS 'Public-facing product catalog. Excludes sensitive pricing fields (cost_price, price_wholesale, price_distributor) to protect business margins.';