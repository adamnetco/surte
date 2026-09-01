REVOKE ALL ON FUNCTION public.consume_lots_fefo(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lots_expiry_summary(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_lots_fefo(uuid, uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lots_expiry_summary(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_lots_fefo(
  _org_id uuid,
  _product_id uuid,
  _warehouse_id uuid,
  _quantity numeric
)
RETURNS TABLE (lot_id uuid, lot_code text, expires_at date, taken numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining numeric := _quantity;
  _rec record;
  _take numeric;
BEGIN
  IF NOT (org_role(_org_id) = ANY (ARRAY['owner','admin','manager','agent'])
          OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role])) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _quantity IS NULL OR _quantity <= 0 THEN
    RETURN;
  END IF;

  FOR _rec IN
    SELECT id, product_lots.lot_code, product_lots.expires_at, quantity
    FROM public.product_lots
    WHERE organization_id = _org_id
      AND product_id = _product_id
      AND warehouse_id = _warehouse_id
      AND is_active
      AND quantity > 0
    ORDER BY product_lots.expires_at NULLS LAST, created_at
    FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(_rec.quantity, _remaining);
    UPDATE public.product_lots SET quantity = quantity - _take WHERE id = _rec.id;
    _remaining := _remaining - _take;
    lot_id := _rec.id;
    lot_code := _rec.lot_code;
    expires_at := _rec.expires_at;
    taken := _take;
    RETURN NEXT;
  END LOOP;

  IF _remaining > 0 THEN
    RAISE EXCEPTION 'insufficient_lot_quantity: faltan % unidades con lote', _remaining;
  END IF;
END;
$$;