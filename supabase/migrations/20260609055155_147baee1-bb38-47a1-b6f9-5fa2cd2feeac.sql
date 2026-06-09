DROP VIEW IF EXISTS public.admin_products_secure;

CREATE OR REPLACE FUNCTION public.get_admin_products_secure()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  price numeric,
  original_price numeric,
  cost_price numeric,
  price_wholesale numeric,
  price_distributor numeric,
  stock integer,
  unit text,
  is_fresh boolean,
  is_wholesale boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  category_id uuid,
  category_name text,
  brand text,
  image_url text,
  sku text,
  gtin text,
  weight text,
  availability text,
  tags text[],
  unit_quantity numeric,
  unit_measure text,
  net_weight_grams numeric,
  base_unit text,
  available_from timestamptz,
  available_until timestamptz,
  available_days integer[],
  available_time_start time,
  available_time_end time,
  organization_id uuid,
  kitchen_station_id uuid,
  meta_title text,
  meta_description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.original_price,
    p.cost_price,
    p.price_wholesale,
    p.price_distributor,
    p.stock,
    p.unit,
    p.is_fresh,
    p.is_wholesale,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.category_id,
    c.name AS category_name,
    p.brand,
    p.image_url,
    p.sku,
    p.gtin,
    p.weight,
    p.availability,
    p.tags,
    p.unit_quantity,
    p.unit_measure,
    p.net_weight_grams,
    p.base_unit,
    p.available_from,
    p.available_until,
    p.available_days,
    p.available_time_start,
    p.available_time_end,
    p.organization_id,
    p.kitchen_station_id,
    p.meta_title,
    p.meta_description
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role, 'admin'::public.app_role, 'editor'::public.app_role])
  ORDER BY p.created_at DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.get_admin_products_secure() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_products_secure() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_products_secure() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_products_secure() TO service_role;