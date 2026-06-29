CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  _order_id uuid,
  _kind text DEFAULT 'receipt'
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.pos_orders%ROWTYPE;
  v_default_printer uuid;
  v_station record;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.pos_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT public.is_member_of(v_order.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Recibo cliente
  IF _kind IN ('receipt','copy') THEN
    SELECT id INTO v_default_printer
      FROM public.printers
     WHERE organization_id = v_order.organization_id
       AND is_active = true
       AND (location_id IS NULL OR location_id = v_order.location_id)
       AND role IN ('receipt','any')
     ORDER BY is_default DESC, created_at ASC
     LIMIT 1;

    INSERT INTO public.print_jobs(organization_id, printer_id, pos_order_id, kind, copies, channel, created_by)
    VALUES (v_order.organization_id, v_default_printer, _order_id, _kind, 1,
            CASE WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%domic%' THEN 'delivery'
                 WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%plata%' THEN 'platform'
                 WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%mesa%'  THEN 'table'
                 WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%llevar%' OR LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%take%' THEN 'takeaway'
                 ELSE 'counter' END,
            auth.uid())
    RETURNING id INTO v_job_id;
    RETURN NEXT v_job_id;
  END IF;

  -- Comandas cocina: una por estación con sus ítems específicos
  IF _kind IN ('kitchen','receipt') THEN
    FOR v_station IN
      SELECT ks.id AS station_id,
             ks.name AS station_name,
             ks.printer_id,
             array_agg(poi.id) AS item_ids
        FROM public.pos_order_items poi
        JOIN public.products p ON p.id = poi.product_id
        JOIN public.kitchen_stations ks
          ON ks.id = COALESCE(p.kitchen_station_id,
               (SELECT c.kitchen_station_id FROM public.categories c WHERE c.id = p.category_id))
       WHERE poi.pos_order_id = _order_id
         AND ks.printer_id IS NOT NULL
       GROUP BY ks.id, ks.name, ks.printer_id
    LOOP
      INSERT INTO public.print_jobs(organization_id, printer_id, pos_order_id, kind, copies, channel, payload, created_by)
      VALUES (v_order.organization_id, v_station.printer_id, _order_id, 'kitchen', 1, 'kitchen',
              jsonb_build_object(
                'station_id', v_station.station_id,
                'station_name', v_station.station_name,
                'item_ids', to_jsonb(v_station.item_ids),
                'kitchen_station_id', v_station.station_id
              ),
              auth.uid())
      RETURNING id INTO v_job_id;
      RETURN NEXT v_job_id;
    END LOOP;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, text) TO authenticated;