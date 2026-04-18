-- Recreate the view with security_invoker = true so it uses the querying user's permissions and RLS
DROP VIEW IF EXISTS public.products_public;

CREATE VIEW public.products_public
WITH (security_invoker = true)
AS
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

GRANT SELECT ON public.products_public TO anon, authenticated;

COMMENT ON VIEW public.products_public IS 'Public-facing product catalog with security_invoker. Excludes cost_price, price_wholesale, price_distributor to protect business margins.';