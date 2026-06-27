
-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_pos_orders_org_paid_at ON public.pos_orders(organization_id, paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_orders_org_status_paid_at ON public.pos_orders(organization_id, status, paid_at);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_order ON public.pos_order_items(pos_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_payments_org_created ON public.pos_payments(organization_id, created_at);

-- 1) Sales summary
CREATE OR REPLACE FUNCTION public.report_sales_summary(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz,
  _granularity text DEFAULT 'day'
)
RETURNS TABLE(
  bucket timestamptz,
  gross numeric,
  net numeric,
  tax numeric,
  discount numeric,
  refunds numeric,
  tickets bigint,
  units numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _trunc text;
BEGIN
  IF NOT public.can_write_org(_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  _trunc := CASE _granularity
    WHEN 'hour' THEN 'hour'
    WHEN 'week' THEN 'week'
    WHEN 'month' THEN 'month'
    ELSE 'day'
  END;
  RETURN QUERY EXECUTE format($f$
    SELECT
      date_trunc(%L, o.paid_at) AS bucket,
      COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS gross,
      COALESCE(SUM(o.subtotal - o.discount) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS net,
      COALESCE(SUM(o.tax) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS tax,
      COALESCE(SUM(o.discount) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS discount,
      COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('voided','refunded')), 0)::numeric AS refunds,
      COUNT(*) FILTER (WHERE o.status NOT IN ('voided','refunded'))::bigint AS tickets,
      COALESCE((SELECT SUM(i.quantity) FROM public.pos_order_items i
                JOIN public.pos_orders o2 ON o2.id = i.pos_order_id
                WHERE o2.organization_id = $1
                  AND o2.paid_at >= $2 AND o2.paid_at < $3
                  AND o2.status NOT IN ('voided','refunded')
                  AND date_trunc(%L, o2.paid_at) = date_trunc(%L, o.paid_at)
               ), 0)::numeric AS units
    FROM public.pos_orders o
    WHERE o.organization_id = $1
      AND o.paid_at >= $2 AND o.paid_at < $3
    GROUP BY 1
    ORDER BY 1
  $f$, _trunc, _trunc, _trunc) USING _org_id, _from, _to;
END;
$$;

-- 2) Top products
CREATE OR REPLACE FUNCTION public.report_top_products(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz,
  _limit int DEFAULT 20
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  sku text,
  units numeric,
  gross numeric,
  tickets bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_write_org(_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    i.product_id,
    MAX(i.product_name)::text,
    MAX(i.sku)::text,
    SUM(i.quantity)::numeric,
    SUM(i.total)::numeric,
    COUNT(DISTINCT i.pos_order_id)::bigint
  FROM public.pos_order_items i
  JOIN public.pos_orders o ON o.id = i.pos_order_id
  WHERE o.organization_id = _org_id
    AND o.paid_at >= _from AND o.paid_at < _to
    AND o.status NOT IN ('voided','refunded')
  GROUP BY i.product_id
  ORDER BY SUM(i.total) DESC NULLS LAST
  LIMIT GREATEST(_limit, 1);
END;
$$;

-- 3) Payment mix
CREATE OR REPLACE FUNCTION public.report_payment_mix(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE(
  method text,
  amount numeric,
  count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_write_org(_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(p.method,'desconocido')::text,
    SUM(p.amount)::numeric,
    COUNT(*)::bigint
  FROM public.pos_payments p
  JOIN public.pos_orders o ON o.id = p.pos_order_id
  WHERE p.organization_id = _org_id
    AND o.paid_at >= _from AND o.paid_at < _to
    AND o.status NOT IN ('voided','refunded')
  GROUP BY p.method
  ORDER BY SUM(p.amount) DESC NULLS LAST;
END;
$$;

-- 4) Cashier performance
CREATE OR REPLACE FUNCTION public.report_cashier_performance(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE(
  cashier_id uuid,
  cashier_name text,
  tickets bigint,
  gross numeric,
  avg_ticket numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_write_org(_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    o.cashier_id,
    COALESCE(MAX(pr.full_name), 'Cajero')::text,
    COUNT(*)::bigint,
    SUM(o.total)::numeric,
    AVG(o.total)::numeric
  FROM public.pos_orders o
  LEFT JOIN public.profiles pr ON pr.id = o.cashier_id
  WHERE o.organization_id = _org_id
    AND o.paid_at >= _from AND o.paid_at < _to
    AND o.status NOT IN ('voided','refunded')
  GROUP BY o.cashier_id
  ORDER BY SUM(o.total) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_summary(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_top_products(uuid, timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_payment_mix(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_cashier_performance(uuid, timestamptz, timestamptz) TO authenticated;
