CREATE OR REPLACE FUNCTION public.pos_dispatch_table_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_loc uuid;
  v_label text;
  v_sub text;
  v_full_label text;
  v_tickets integer := 0;
  v_jobs integer := 0;
  v_rec record;
  v_payload jsonb;
BEGIN
  SELECT t.organization_id, t.location_id,
         COALESCE(dt.label, dt.code, 'Mesa'), COALESCE(t.sub_label, '')
    INTO v_org, v_loc, v_label, v_sub
  FROM public.table_orders t
  LEFT JOIN public.dining_tables dt ON dt.id = t.dining_table_id
  WHERE t.id = p_order_id;

  IF v_org IS NULL THEN RAISE EXCEPTION 'orden no encontrada'; END IF;
  IF NOT public.is_org_member(v_org) THEN RAISE EXCEPTION 'sin permisos'; END IF;

  v_full_label := v_label || v_sub;

  -- 1) Auto-asignar estación faltante: producto -> categoría
  UPDATE public.table_order_items oi
     SET kitchen_station_id = COALESCE(p.kitchen_station_id, c.kitchen_station_id)
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
   WHERE oi.table_order_id = p_order_id
     AND oi.organization_id = v_org
     AND oi.status = 'pending'
     AND oi.kitchen_station_id IS NULL
     AND oi.product_id = p.id;

  -- 2) Por cada estación con items pendientes: insertar KDS ticket + print job
  FOR v_rec IN
    SELECT oi.kitchen_station_id AS station_id,
           jsonb_agg(jsonb_build_object(
             'name', oi.product_name,
             'qty',  oi.quantity,
             'notes', oi.notes
           ) ORDER BY oi.created_at) AS items,
           ks.printer_id AS printer_id,
           ks.name AS station_name
      FROM public.table_order_items oi
      LEFT JOIN public.kitchen_stations ks ON ks.id = oi.kitchen_station_id
     WHERE oi.table_order_id = p_order_id
       AND oi.organization_id = v_org
       AND oi.status = 'pending'
     GROUP BY oi.kitchen_station_id, ks.printer_id, ks.name
  LOOP
    INSERT INTO public.kds_tickets (organization_id, location_id, kitchen_station_id,
                                    table_order_id, dining_table_label, items, status)
    VALUES (v_org, v_loc, v_rec.station_id, p_order_id, v_full_label, v_rec.items, 'pending');
    v_tickets := v_tickets + 1;

    IF v_rec.printer_id IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'table_label', v_full_label,
        'station_name', COALESCE(v_rec.station_name, 'Cocina'),
        'items', v_rec.items,
        'issued_at', to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI')
      );
      INSERT INTO public.print_jobs (organization_id, printer_id, kind, payload, status, copies)
      VALUES (v_org, v_rec.printer_id, 'kitchen_ticket', v_payload, 'queued', 1);
      v_jobs := v_jobs + 1;
    END IF;
  END LOOP;

  -- 3) Marcar items como enviados
  UPDATE public.table_order_items
     SET status = 'sent', sent_at = now()
   WHERE table_order_id = p_order_id
     AND organization_id = v_org
     AND status = 'pending';

  -- 4) Marcar orden como enviada
  UPDATE public.table_orders
     SET status = 'sent', updated_at = now()
   WHERE id = p_order_id AND organization_id = v_org;

  RETURN jsonb_build_object('tickets', v_tickets, 'print_jobs', v_jobs);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_dispatch_table_order(uuid) TO authenticated;