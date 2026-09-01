CREATE OR REPLACE FUNCTION public.pos_sale_commit(
  _org_id uuid,
  _client_uuid uuid,
  _header jsonb,
  _items jsonb DEFAULT '[]'::jsonb,
  _payments jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _org_id IS NULL OR _client_uuid IS NULL THEN
    RAISE EXCEPTION 'pos_sale_commit: _org_id y _client_uuid son obligatorios';
  END IF;

  SELECT id INTO v_id
    FROM public.pos_orders
   WHERE client_uuid = _client_uuid AND organization_id = _org_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.pos_orders (
    organization_id, client_uuid, location_id, cash_session_id, cashier_id,
    subtotal, tax, discount, tip, total, amount_paid, change_due,
    status, sale_mode, einvoice_doc_type, paid_at, notes,
    customer_name, customer_phone, customer_document, customer_profile_id, metadata
  ) VALUES (
    _org_id,
    _client_uuid,
    (_header->>'location_id')::uuid,
    (_header->>'cash_session_id')::uuid,
    (_header->>'cashier_id')::uuid,
    COALESCE((_header->>'subtotal')::numeric, 0),
    COALESCE((_header->>'tax')::numeric, 0),
    COALESCE((_header->>'discount')::numeric, 0),
    COALESCE((_header->>'tip')::numeric, 0),
    COALESCE((_header->>'total')::numeric, 0),
    COALESCE((_header->>'amount_paid')::numeric, 0),
    COALESCE((_header->>'change_due')::numeric, 0),
    COALESCE(_header->>'status', 'paid'),
    COALESCE(_header->>'sale_mode', 'counter'),
    _header->>'einvoice_doc_type',
    COALESCE((_header->>'paid_at')::timestamptz, now()),
    _header->>'notes',
    _header->>'customer_name',
    _header->>'customer_phone',
    _header->>'customer_document',
    NULLIF(_header->>'customer_profile_id', '')::uuid,
    COALESCE(_header->'metadata', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.pos_order_items (
    organization_id, pos_order_id, product_id, presentation_id, product_name, sku,
    quantity, unit_price, discount, tax_rate, tax_amount, total, notes, modifiers
  )
  SELECT
    _org_id, v_id,
    NULLIF(i->>'product_id', '')::uuid,
    NULLIF(i->>'presentation_id', '')::uuid,
    i->>'product_name',
    i->>'sku',
    COALESCE((i->>'quantity')::numeric, 0),
    COALESCE((i->>'unit_price')::numeric, 0),
    COALESCE((i->>'discount')::numeric, 0),
    COALESCE((i->>'tax_rate')::numeric, 0),
    COALESCE((i->>'tax_amount')::numeric, 0),
    COALESCE((i->>'total')::numeric, 0),
    i->>'notes',
    COALESCE(i->'modifiers', '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) AS i;

  INSERT INTO public.pos_payments (
    organization_id, pos_order_id, cash_session_id, method, amount, reference, received_by, metadata
  )
  SELECT
    _org_id, v_id,
    COALESCE(NULLIF(p->>'cash_session_id', '')::uuid, (_header->>'cash_session_id')::uuid),
    p->>'method',
    COALESCE((p->>'amount')::numeric, 0),
    p->>'reference',
    COALESCE(NULLIF(p->>'received_by', '')::uuid, (_header->>'cashier_id')::uuid),
    COALESCE(p->'metadata', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(_payments, '[]'::jsonb)) AS p;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_id
      FROM public.pos_orders
     WHERE client_uuid = _client_uuid AND organization_id = _org_id;
    IF v_id IS NULL THEN
      RAISE;
    END IF;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sale_commit(uuid, uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sale_commit(uuid, uuid, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sale_commit(uuid, uuid, jsonb, jsonb, jsonb) TO service_role;