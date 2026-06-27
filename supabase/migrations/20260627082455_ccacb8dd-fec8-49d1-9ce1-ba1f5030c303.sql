
CREATE OR REPLACE FUNCTION public.receive_purchase_order_partial(
  _po_id uuid,
  _warehouse_id uuid,
  _lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_line jsonb;
  v_item public.purchase_order_items%ROWTYPE;
  v_qty numeric;
  v_new_received numeric;
  v_applied int := 0;
  v_pending int := 0;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = _po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'po_not_found'; END IF;
  IF NOT public.is_member_of(v_po.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_po.status = 'received' THEN RAISE EXCEPTION 'already_received'; END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_qty := COALESCE((v_line->>'qty')::numeric, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_item
    FROM public.purchase_order_items
    WHERE id = (v_line->>'item_id')::uuid
      AND purchase_order_id = _po_id
      AND applied = false;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF v_item.product_id IS NULL THEN CONTINUE; END IF;

    -- Cap qty at remaining
    v_qty := LEAST(v_qty, v_item.quantity_ordered - COALESCE(v_item.quantity_received, 0));
    IF v_qty <= 0 THEN CONTINUE; END IF;

    PERFORM public.apply_stock_movement(
      v_po.organization_id, _warehouse_id,
      v_item.product_id, v_item.presentation_id,
      'purchase', v_qty, v_item.unit_cost,
      'purchase_order', _po_id,
      'PO ' || COALESCE(v_po.po_code, v_po.id::text) || ' (parcial)'
    );

    v_new_received := COALESCE(v_item.quantity_received, 0) + v_qty;
    UPDATE public.purchase_order_items
       SET quantity_received = v_new_received,
           applied = (v_new_received >= quantity_ordered)
     WHERE id = v_item.id;

    IF v_item.supplier_sku IS NOT NULL THEN
      UPDATE public.supplier_products
         SET last_purchased_at = now(), unit_cost = v_item.unit_cost
       WHERE supplier_id = v_po.supplier_id AND supplier_sku = v_item.supplier_sku;
    END IF;

    v_applied := v_applied + 1;
  END LOOP;

  -- Recalcular estado de la OC
  SELECT COUNT(*) INTO v_pending
  FROM public.purchase_order_items
  WHERE purchase_order_id = _po_id AND applied = false AND product_id IS NOT NULL;

  IF v_pending = 0 THEN
    UPDATE public.purchase_orders
       SET status = 'received', received_at = now(), warehouse_id = _warehouse_id
     WHERE id = _po_id;
  ELSE
    UPDATE public.purchase_orders
       SET status = 'partial', warehouse_id = _warehouse_id
     WHERE id = _po_id;
  END IF;

  RETURN jsonb_build_object('applied_lines', v_applied, 'pending_lines', v_pending);
END $$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order_partial(uuid, uuid, jsonb) TO authenticated;
