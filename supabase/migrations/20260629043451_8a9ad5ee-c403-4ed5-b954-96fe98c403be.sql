
-- Ola 26 Slice 1: Sub-letras de mesa (15A/15B/15C)
-- Permite dividir una mesa física en sub-cuentas independientes mediante un sufijo.

ALTER TABLE public.table_orders
  ADD COLUMN IF NOT EXISTS sub_label text NULL,
  ADD COLUMN IF NOT EXISTS parent_table_order_id uuid NULL REFERENCES public.table_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.table_orders.sub_label IS 'Sufijo A/B/C cuando una mesa se divide en sub-cuentas';
COMMENT ON COLUMN public.table_orders.parent_table_order_id IS 'Apunta al ticket original cuando este nace de un split';

CREATE INDEX IF NOT EXISTS idx_table_orders_parent ON public.table_orders(parent_table_order_id) WHERE parent_table_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_orders_dining_open ON public.table_orders(dining_table_id, status) WHERE status IN ('open','billed');

-- Helper: siguiente sub-letra disponible para una mesa
CREATE OR REPLACE FUNCTION public.next_sub_label(_dining_table_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used text[];
  candidate text;
  i int;
BEGIN
  SELECT array_agg(COALESCE(sub_label,'A')) INTO used
  FROM public.table_orders
  WHERE dining_table_id = _dining_table_id
    AND status IN ('open','billed');

  IF used IS NULL OR array_length(used,1) IS NULL THEN
    RETURN 'A';
  END IF;

  FOR i IN 0..25 LOOP
    candidate := chr(65 + i);
    IF NOT (candidate = ANY(used)) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  RETURN 'Z';
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_sub_label(uuid) TO authenticated;

-- RPC: split_table_order — crea un nuevo ticket hijo con la siguiente sub-letra
CREATE OR REPLACE FUNCTION public.split_table_order(_source uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.table_orders%ROWTYPE;
  new_id uuid;
  new_sub text;
  parent_sub text;
BEGIN
  SELECT * INTO src FROM public.table_orders WHERE id = _source FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket de mesa no encontrado'; END IF;
  IF src.status NOT IN ('open','billed') THEN RAISE EXCEPTION 'Solo se puede dividir un ticket abierto'; END IF;

  -- Si el origen no tiene sub_label aún, marcarlo como A
  IF src.sub_label IS NULL THEN
    UPDATE public.table_orders SET sub_label='A', updated_at=now() WHERE id = src.id;
    parent_sub := 'A';
  END IF;

  new_sub := public.next_sub_label(src.dining_table_id);

  INSERT INTO public.table_orders (
    organization_id, location_id, dining_table_id, service_type_key,
    waiter_id, guest_count, status, sub_label, parent_table_order_id, opened_at
  ) VALUES (
    src.organization_id, src.location_id, src.dining_table_id, src.service_type_key,
    src.waiter_id, 1, 'open', new_sub, COALESCE(src.parent_table_order_id, src.id), now()
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_table_order(uuid) TO authenticated;

-- RPC: transfer_table_item — mueve un item entre tickets de la misma mesa
CREATE OR REPLACE FUNCTION public.transfer_table_item(_item uuid, _dest_order uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it public.table_order_items%ROWTYPE;
  dest public.table_orders%ROWTYPE;
BEGIN
  SELECT * INTO it FROM public.table_order_items WHERE id = _item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item no encontrado'; END IF;
  SELECT * INTO dest FROM public.table_orders WHERE id = _dest_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destino no encontrado'; END IF;
  IF dest.status <> 'open' THEN RAISE EXCEPTION 'El destino no está abierto'; END IF;

  UPDATE public.table_order_items
  SET table_order_id = _dest_order, updated_at = now()
  WHERE id = _item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_table_item(uuid, uuid) TO authenticated;
