CREATE OR REPLACE FUNCTION public.report_sales_by_location(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE(
  location_id uuid,
  location_name text,
  tickets bigint,
  gross numeric,
  net numeric,
  tax numeric,
  discount numeric,
  refunds numeric,
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
    o.location_id,
    COALESCE(l.name, 'Sin sucursal') AS location_name,
    COUNT(*) FILTER (WHERE o.status NOT IN ('voided','refunded'))::bigint AS tickets,
    COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS gross,
    COALESCE(SUM(o.subtotal - o.discount) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS net,
    COALESCE(SUM(o.tax) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS tax,
    COALESCE(SUM(o.discount) FILTER (WHERE o.status NOT IN ('voided','refunded')), 0)::numeric AS discount,
    COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('voided','refunded')), 0)::numeric AS refunds,
    CASE WHEN COUNT(*) FILTER (WHERE o.status NOT IN ('voided','refunded')) > 0
         THEN COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('voided','refunded')),0) /
              COUNT(*) FILTER (WHERE o.status NOT IN ('voided','refunded'))
         ELSE 0
    END::numeric AS avg_ticket
  FROM public.pos_orders o
  LEFT JOIN public.locations l ON l.id = o.location_id
  WHERE o.organization_id = _org_id
    AND o.paid_at >= _from AND o.paid_at < _to
  GROUP BY o.location_id, l.name
  ORDER BY gross DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_location(uuid, timestamptz, timestamptz) TO authenticated;