CREATE OR REPLACE FUNCTION public.inventory_kardex(
  _product_id uuid,
  _from timestamptz DEFAULT (now() - interval '90 days'),
  _to timestamptz DEFAULT now(),
  _warehouse_id uuid DEFAULT NULL
)
RETURNS TABLE (
  movement_at timestamptz,
  movement_type text,
  warehouse_id uuid,
  warehouse_name text,
  quantity numeric,
  unit_cost numeric,
  balance_after numeric,
  running_balance numeric,
  reference_type text,
  reference_id uuid,
  notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
BEGIN
  SELECT p.organization_id INTO _org FROM public.products p WHERE p.id = _product_id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT (
    public.is_member_of(_org)
    OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role])
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      m.created_at        AS movement_at,
      m.movement_type,
      m.warehouse_id,
      w.name              AS warehouse_name,
      m.quantity,
      m.unit_cost,
      m.balance_after,
      m.reference_type,
      m.reference_id,
      m.notes
    FROM public.stock_movements m
    LEFT JOIN public.warehouses w ON w.id = m.warehouse_id
    WHERE m.product_id = _product_id
      AND m.created_at >= _from
      AND m.created_at <= _to
      AND (_warehouse_id IS NULL OR m.warehouse_id = _warehouse_id)
  )
  SELECT
    b.movement_at,
    b.movement_type,
    b.warehouse_id,
    b.warehouse_name,
    b.quantity,
    b.unit_cost,
    b.balance_after,
    SUM(b.quantity) OVER (
      PARTITION BY b.warehouse_id
      ORDER BY b.movement_at, b.movement_type
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance,
    b.reference_type,
    b.reference_id,
    b.notes
  FROM base b
  ORDER BY b.movement_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_kardex(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_kardex(uuid, timestamptz, timestamptz, uuid) TO authenticated;