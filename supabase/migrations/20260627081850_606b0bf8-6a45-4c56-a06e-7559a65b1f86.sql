
CREATE OR REPLACE FUNCTION public.suggest_purchase_orders(
  _organization_id uuid,
  _lookback_days int DEFAULT 30,
  _coverage_days int DEFAULT 14
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  product_sku text,
  current_stock numeric,
  reorder_point numeric,
  avg_daily_sales numeric,
  suggested_qty numeric,
  supplier_id uuid,
  supplier_name text,
  unit_cost numeric,
  pack_size int,
  estimated_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT poi.product_id,
           SUM(poi.quantity)::numeric / GREATEST(_lookback_days, 1) AS avg_daily
    FROM public.pos_order_items poi
    JOIN public.pos_orders po ON po.id = poi.pos_order_id
    WHERE po.organization_id = _organization_id
      AND po.status = 'completed'
      AND po.created_at >= now() - (_lookback_days || ' days')::interval
    GROUP BY poi.product_id
  ),
  stock AS (
    SELECT ps.product_id,
           SUM(ps.quantity)::numeric AS qty,
           MAX(COALESCE(ps.reorder_point, 0))::numeric AS rop
    FROM public.product_stock ps
    WHERE ps.organization_id = _organization_id
    GROUP BY ps.product_id
  ),
  preferred AS (
    SELECT DISTINCT ON (sp.product_id)
      sp.product_id, sp.supplier_id, sp.unit_cost, sp.pack_size, s.name AS supplier_name
    FROM public.supplier_products sp
    JOIN public.suppliers s ON s.id = sp.supplier_id
    WHERE sp.organization_id = _organization_id AND s.is_active = true
    ORDER BY sp.product_id, sp.is_preferred DESC, sp.unit_cost ASC NULLS LAST
  )
  SELECT
    p.id, p.name, p.sku,
    COALESCE(st.qty, 0) AS current_stock,
    COALESCE(st.rop, 0) AS reorder_point,
    COALESCE(s.avg_daily, 0) AS avg_daily_sales,
    GREATEST(CEIL(COALESCE(s.avg_daily,0) * _coverage_days - COALESCE(st.qty,0)), 0)::numeric AS suggested_qty,
    pr.supplier_id, pr.supplier_name, pr.unit_cost,
    COALESCE(pr.pack_size, 1) AS pack_size,
    (GREATEST(CEIL(COALESCE(s.avg_daily,0) * _coverage_days - COALESCE(st.qty,0)), 0) * COALESCE(pr.unit_cost, 0))::numeric AS estimated_total
  FROM public.products p
  LEFT JOIN stock st ON st.product_id = p.id
  LEFT JOIN sales s ON s.product_id = p.id
  LEFT JOIN preferred pr ON pr.product_id = p.id
  WHERE p.organization_id = _organization_id
    AND p.is_active = true
    AND COALESCE(s.avg_daily, 0) > 0
    AND (COALESCE(st.qty,0) <= COALESCE(st.rop,0)
         OR COALESCE(s.avg_daily,0) * _coverage_days > COALESCE(st.qty,0))
  ORDER BY pr.supplier_name NULLS LAST, p.name
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_purchase_orders(uuid, int, int) TO authenticated;
