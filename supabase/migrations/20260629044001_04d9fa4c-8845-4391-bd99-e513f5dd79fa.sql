-- Ola 26 Slice 2: KDS color-por-tiempo + items individuales
ALTER TABLE public.kitchen_stations
  ADD COLUMN IF NOT EXISTS sla_minutes integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.kitchen_stations.sla_minutes IS 'Tiempo objetivo (min) antes de marcar comanda en rojo (urgente).';

-- RPC: alternar estado done de un item dentro de un kds_ticket
CREATE OR REPLACE FUNCTION public.kds_toggle_item(
  p_ticket_id uuid,
  p_item_index integer,
  p_done boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_items jsonb;
  v_new_items jsonb;
  v_total integer;
  v_done integer;
BEGIN
  SELECT organization_id, items INTO v_org, v_items
  FROM public.kds_tickets WHERE id = p_ticket_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'ticket no encontrado';
  END IF;

  IF NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'sin permisos';
  END IF;

  IF jsonb_typeof(v_items) <> 'array' OR p_item_index < 0 OR p_item_index >= jsonb_array_length(v_items) THEN
    RAISE EXCEPTION 'item fuera de rango';
  END IF;

  v_new_items := jsonb_set(v_items, ARRAY[p_item_index::text, 'done'], to_jsonb(p_done), true);

  v_total := jsonb_array_length(v_new_items);
  SELECT count(*) INTO v_done
  FROM jsonb_array_elements(v_new_items) e
  WHERE (e->>'done')::boolean IS TRUE;

  UPDATE public.kds_tickets
     SET items = v_new_items,
         updated_at = now()
   WHERE id = p_ticket_id;

  RETURN jsonb_build_object('total', v_total, 'done', v_done);
END;
$$;

GRANT EXECUTE ON FUNCTION public.kds_toggle_item(uuid, integer, boolean) TO authenticated;