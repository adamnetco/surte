CREATE OR REPLACE FUNCTION public.inventory_critical_summary(_org_id uuid)
RETURNS TABLE (
  stock_id uuid,
  warehouse_id uuid,
  warehouse_name text,
  product_id uuid,
  product_name text,
  sku text,
  image_url text,
  quantity numeric,
  min_stock numeric,
  reorder_point numeric,
  max_stock numeric,
  avg_cost numeric,
  suggested_qty numeric,
  severity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.id AS stock_id,
    ps.warehouse_id,
    w.name AS warehouse_name,
    ps.product_id,
    p.name AS product_name,
    p.sku,
    p.image_url,
    ps.quantity,
    ps.min_stock,
    ps.reorder_point,
    ps.max_stock,
    ps.avg_cost,
    GREATEST(
      COALESCE(NULLIF(ps.max_stock, 0), COALESCE(ps.reorder_point, ps.min_stock) * 2) - ps.quantity,
      0
    ) AS suggested_qty,
    CASE
      WHEN ps.quantity <= 0 THEN 'critical'
      WHEN ps.quantity <= COALESCE(ps.min_stock, 0) THEN 'critical'
      WHEN ps.quantity <= COALESCE(ps.reorder_point, ps.min_stock, 0) THEN 'warning'
      ELSE 'ok'
    END AS severity
  FROM public.product_stock ps
  JOIN public.warehouses w ON w.id = ps.warehouse_id
  JOIN public.products p ON p.id = ps.product_id
  WHERE ps.organization_id = _org_id
    AND ps.quantity <= GREATEST(COALESCE(ps.reorder_point, 0), COALESCE(ps.min_stock, 0))
    AND COALESCE(ps.reorder_point, ps.min_stock, 0) > 0
  ORDER BY
    CASE
      WHEN ps.quantity <= 0 THEN 0
      WHEN ps.quantity <= COALESCE(ps.min_stock, 0) THEN 1
      ELSE 2
    END,
    p.name;
$$;

GRANT EXECUTE ON FUNCTION public.inventory_critical_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_critical_summary(uuid) TO service_role;