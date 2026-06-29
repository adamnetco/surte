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
  v_channel text;
  v_group record;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.pos_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT public.is_member_of(v_order.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_channel := CASE
    WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%domic%' THEN 'delivery'
    WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%plata%' THEN 'platform'
    WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%mesa%'  THEN 'table'
    WHEN LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%llevar%' OR LOWER(COALESCE(v_order.sale_mode,'')) LIKE '%take%' THEN 'takeaway'
    ELSE 'counter'
  END;

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
    VALUES (v_order.organization_id, v_default_printer, _order_id, _kind, 1, v_channel, auth.uid())
    RETURNING id INTO v_job_id;
    RETURN NEXT v_job_id;
  END IF;

  -- Comandas cocina: resolver impresora destino por reglas avanzadas (priority asc)
  -- con fallback a la impresora por defecto de la estación.
  IF _kind IN ('kitchen','receipt') THEN
    FOR v_group IN
      WITH item_resolution AS (
        SELECT
          poi.id  AS item_id,
          p.id    AS product_id,
          p.category_id,
          COALESCE(p.kitchen_station_id,
                   (SELECT c.kitchen_station_id FROM public.categories c WHERE c.id = p.category_id)
          ) AS station_id
        FROM public.pos_order_items poi
        JOIN public.products p ON p.id = poi.product_id
        WHERE poi.pos_order_id = _order_id
      ),
      ranked AS (
        SELECT
          ir.item_id,
          ir.station_id,
          rr.printer_id     AS rule_printer,
          rr.copies         AS rule_copies,
          rr.prints_on      AS rule_prints_on,
          row_number() OVER (
            PARTITION BY ir.item_id
            ORDER BY
              -- producto explícito > categoría > estación
              CASE WHEN rr.product_id IS NOT NULL THEN 0
                   WHEN rr.category_id IS NOT NULL THEN 1
                   WHEN rr.kitchen_station_id IS NOT NULL THEN 2
                   ELSE 3 END,
              rr.priority ASC,
              rr.created_at ASC
          ) AS rn
        FROM item_resolution ir
        LEFT JOIN public.printer_routing_rules rr
          ON rr.organization_id = v_order.organization_id
         AND rr.is_active = true
         AND rr.prints_on IN ('kitchen','both')
         AND (
              rr.product_id = ir.product_id
           OR rr.category_id = ir.category_id
           OR rr.kitchen_station_id = ir.station_id
         )
      ),
      resolved AS (
        SELECT
          r.item_id,
          r.station_id,
          -- Si hay regla, usar su impresora; si no, la impresora por defecto de la estación.
          COALESCE(r.rule_printer, ks.printer_id) AS final_printer,
          COALESCE(ks.name, 'COCINA')             AS station_name,
          COALESCE(r.rule_copies, 1)              AS copies
        FROM ranked r
        LEFT JOIN public.kitchen_stations ks ON ks.id = r.station_id
        WHERE r.rn = 1
      )
      SELECT
        final_printer AS printer_id,
        station_id,
        MAX(station_name) AS station_name,
        MAX(copies)       AS copies,
        array_agg(item_id) AS item_ids
      FROM resolved
      WHERE final_printer IS NOT NULL
      GROUP BY final_printer, station_id
    LOOP
      INSERT INTO public.print_jobs(organization_id, printer_id, pos_order_id, kind, copies, channel, payload, created_by)
      VALUES (v_order.organization_id, v_group.printer_id, _order_id, 'kitchen', v_group.copies, 'kitchen',
              jsonb_build_object(
                'station_id', v_group.station_id,
                'station_name', v_group.station_name,
                'item_ids', to_jsonb(v_group.item_ids),
                'kitchen_station_id', v_group.station_id
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