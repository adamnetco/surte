CREATE OR REPLACE FUNCTION public.pos_receipt_template_resolve(
  _org_id UUID,
  _channel public.pos_receipt_channel DEFAULT 'counter'
)
RETURNS public.pos_receipt_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl public.pos_receipt_templates;
  default_layout JSONB := '{
    "sections": [
      {"id":"logo","type":"logo","visible":true,"align":"center"},
      {"id":"store","type":"store_info","visible":true,"fields":["name","nit","address","phone"]},
      {"id":"divider1","type":"divider","visible":true,"char":"="},
      {"id":"meta","type":"order_meta","visible":true,"fields":["order_number","date","cashier"]},
      {"id":"customer","type":"customer","visible":true},
      {"id":"divider2","type":"divider","visible":true,"char":"-"},
      {"id":"items","type":"items","visible":true,"columns":["qty","name","total"],"showModifiers":true},
      {"id":"divider3","type":"divider","visible":true,"char":"-"},
      {"id":"totals","type":"totals","visible":true,"showTax":true,"showTip":true},
      {"id":"payments","type":"payments","visible":true},
      {"id":"qr","type":"qr","visible":false,"content":"order_url"},
      {"id":"footer","type":"text","visible":true,"value":"Gracias por su compra"}
    ]
  }'::jsonb;
  kitchen_layout JSONB := '{
    "sections": [
      {"id":"station","type":"station_header","visible":true,"fields":["station","table","time"]},
      {"id":"divider1","type":"divider","visible":true,"char":"="},
      {"id":"meta","type":"order_meta","visible":true,"fields":["order_number","cashier"]},
      {"id":"divider2","type":"divider","visible":true,"char":"-"},
      {"id":"kitems","type":"kitchen_items","visible":true,"showModifiers":true,"showNotes":true,"bigFont":true},
      {"id":"divider3","type":"divider","visible":true,"char":"="}
    ]
  }'::jsonb;
  void_layout JSONB := '{
    "sections": [
      {"id":"logo","type":"logo","visible":true,"align":"center"},
      {"id":"store","type":"store_info","visible":true,"fields":["name","nit"]},
      {"id":"divider1","type":"divider","visible":true,"char":"="},
      {"id":"void","type":"void_notice","visible":true,"showReason":true,"showFiscalHash":true},
      {"id":"divider2","type":"divider","visible":true,"char":"-"},
      {"id":"items","type":"items","visible":true,"columns":["qty","name","total"],"showModifiers":false},
      {"id":"totals","type":"totals","visible":true,"showTax":true,"showTip":false},
      {"id":"divider3","type":"divider","visible":true,"char":"="},
      {"id":"footer","type":"text","visible":true,"value":"Documento de anulación - conserve para soporte"}
    ]
  }'::jsonb;
  chosen_layout JSONB;
  chosen_name TEXT;
BEGIN
  IF NOT (
    public.is_member_of(_org_id)
    OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role])
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO tpl FROM public.pos_receipt_templates
  WHERE organization_id = _org_id AND channel = _channel AND is_default = true
  LIMIT 1;

  IF FOUND THEN RETURN tpl; END IF;

  chosen_layout := CASE _channel
    WHEN 'kitchen' THEN kitchen_layout
    WHEN 'void'    THEN void_layout
    ELSE default_layout
  END;
  chosen_name := CASE _channel
    WHEN 'counter'   THEN 'Mostrador 80mm'
    WHEN 'delivery'  THEN 'Domicilio 80mm'
    WHEN 'platform'  THEN 'Plataforma 80mm'
    WHEN 'table'     THEN 'Mesa 80mm'
    WHEN 'takeaway'  THEN 'Para llevar 80mm'
    WHEN 'kitchen'   THEN 'Comanda cocina'
    WHEN 'void'      THEN 'Vale de anulación'
  END;

  INSERT INTO public.pos_receipt_templates(
    organization_id, name, channel, is_default, paper_width_mm, layout
  ) VALUES (
    _org_id, chosen_name, _channel, true, 80, chosen_layout
  ) RETURNING * INTO tpl;

  RETURN tpl;
END $$;