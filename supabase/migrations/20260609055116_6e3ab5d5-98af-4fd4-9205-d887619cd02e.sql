CREATE OR REPLACE VIEW public.admin_products_secure AS
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
WHERE public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role, 'admin'::public.app_role, 'editor'::public.app_role]);

GRANT SELECT ON public.admin_products_secure TO authenticated;
GRANT SELECT ON public.admin_products_secure TO service_role;

COMMENT ON VIEW public.admin_products_secure IS 'Internal inventory read model. Includes sensitive product margin fields only when auth.uid() has superadmin, admin, or editor role.';