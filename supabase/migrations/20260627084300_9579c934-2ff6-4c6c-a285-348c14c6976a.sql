
CREATE OR REPLACE FUNCTION public.supplier_performance(p_org uuid, p_days int DEFAULT 90)
RETURNS TABLE(
  supplier_id uuid, supplier_name text, city text, lead_time_target int,
  po_count bigint, total_value numeric, avg_lead_time_real numeric,
  on_time_rate numeric, fill_rate numeric, last_order_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT po.*, s.name AS s_name, s.city AS s_city, s.lead_time_days AS s_lead
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id AND s.organization_id = po.organization_id
    WHERE po.organization_id = p_org
      AND po.created_at >= now() - (p_days || ' days')::interval
      AND EXISTS (SELECT 1 FROM organization_members om
                  WHERE om.organization_id = p_org AND om.user_id = auth.uid() AND om.is_active = true)
  ),
  items AS (
    SELECT poi.purchase_order_id,
           SUM(poi.quantity_ordered) AS qo,
           SUM(COALESCE(poi.quantity_received,0)) AS qr
    FROM purchase_order_items poi
    WHERE poi.organization_id = p_org
    GROUP BY poi.purchase_order_id
  )
  SELECT b.supplier_id, MAX(b.s_name), MAX(b.s_city), MAX(b.s_lead),
         COUNT(*)::bigint, COALESCE(SUM(b.total),0),
         AVG(EXTRACT(EPOCH FROM (b.received_at - b.created_at))/86400.0)
           FILTER (WHERE b.received_at IS NOT NULL),
         AVG(CASE WHEN b.received_at IS NULL OR b.expected_at IS NULL THEN NULL
                  WHEN b.received_at::date <= b.expected_at THEN 1 ELSE 0 END)::numeric,
         CASE WHEN SUM(i.qo) > 0 THEN SUM(i.qr)/SUM(i.qo) ELSE NULL END,
         MAX(b.created_at)
  FROM base b LEFT JOIN items i ON i.purchase_order_id = b.id
  GROUP BY b.supplier_id ORDER BY COALESCE(SUM(b.total),0) DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.supplier_performance(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.supplier_price_variations(p_org uuid, p_supplier_id uuid, p_days int DEFAULT 180)
RETURNS TABLE(
  product_id uuid, product_name text, sku text, buys bigint,
  min_cost numeric, max_cost numeric, avg_cost numeric, last_cost numeric, variation_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lines AS (
    SELECT poi.product_id, poi.unit_cost, po.created_at
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE poi.organization_id = p_org
      AND po.supplier_id = p_supplier_id
      AND po.created_at >= now() - (p_days || ' days')::interval
      AND poi.unit_cost IS NOT NULL AND poi.unit_cost > 0
      AND EXISTS (SELECT 1 FROM organization_members om
                  WHERE om.organization_id = p_org AND om.user_id = auth.uid() AND om.is_active = true)
  ),
  agg AS (
    SELECT product_id, COUNT(*)::bigint AS buys,
           MIN(unit_cost) AS min_cost, MAX(unit_cost) AS max_cost, AVG(unit_cost) AS avg_cost,
           (ARRAY_AGG(unit_cost ORDER BY created_at DESC))[1] AS last_cost
    FROM lines GROUP BY product_id
  )
  SELECT a.product_id, p.name, p.sku, a.buys, a.min_cost, a.max_cost, a.avg_cost, a.last_cost,
         CASE WHEN a.min_cost > 0 THEN (a.max_cost - a.min_cost)/a.min_cost ELSE 0 END
  FROM agg a LEFT JOIN products p ON p.id = a.product_id
  ORDER BY CASE WHEN a.min_cost > 0 THEN (a.max_cost - a.min_cost)/a.min_cost ELSE 0 END DESC, a.buys DESC;
$$;
GRANT EXECUTE ON FUNCTION public.supplier_price_variations(uuid, uuid, int) TO authenticated;
