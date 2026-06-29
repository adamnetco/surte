-- Ola 27 Slice 1: pos_receipt_templates
CREATE TYPE public.pos_receipt_channel AS ENUM (
  'counter','delivery','platform','table','takeaway','kitchen','void'
);

CREATE TABLE public.pos_receipt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel public.pos_receipt_channel NOT NULL DEFAULT 'counter',
  is_default BOOLEAN NOT NULL DEFAULT false,
  paper_width_mm INTEGER NOT NULL DEFAULT 80 CHECK (paper_width_mm IN (58, 80)),
  font_size_pt INTEGER NOT NULL DEFAULT 10 CHECK (font_size_pt BETWEEN 8 AND 14),
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 4),
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_qr_pago BOOLEAN NOT NULL DEFAULT false,
  show_nit BOOLEAN NOT NULL DEFAULT true,
  header_text TEXT,
  footer_text TEXT DEFAULT 'Gracias por su compra',
  layout JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_receipt_templates TO authenticated;
GRANT ALL ON public.pos_receipt_templates TO service_role;

ALTER TABLE public.pos_receipt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read templates"
  ON public.pos_receipt_templates FOR SELECT TO authenticated
  USING (
    public.is_member_of(organization_id)
    OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role])
  );

CREATE POLICY "managers manage templates"
  ON public.pos_receipt_templates FOR ALL TO authenticated
  USING (
    public.org_role(organization_id) = ANY (ARRAY['owner','admin','manager'])
    OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role])
  )
  WITH CHECK (
    public.org_role(organization_id) = ANY (ARRAY['owner','admin','manager'])
    OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role])
  );

CREATE INDEX idx_pos_receipt_templates_org_channel
  ON public.pos_receipt_templates(organization_id, channel);

CREATE UNIQUE INDEX uniq_pos_receipt_templates_default_per_channel
  ON public.pos_receipt_templates(organization_id, channel)
  WHERE is_default = true;

CREATE TRIGGER trg_pos_receipt_templates_updated_at
  BEFORE UPDATE ON public.pos_receipt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper RPC: resolve/auto-seed default template per channel for an org
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
BEGIN
  -- Authorization: must be a member of the org or a superadmin
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

  INSERT INTO public.pos_receipt_templates(
    organization_id, name, channel, is_default, paper_width_mm, layout
  ) VALUES (
    _org_id,
    CASE _channel
      WHEN 'counter'   THEN 'Mostrador 80mm'
      WHEN 'delivery'  THEN 'Domicilio 80mm'
      WHEN 'platform'  THEN 'Plataforma 80mm'
      WHEN 'table'     THEN 'Mesa 80mm'
      WHEN 'takeaway'  THEN 'Para llevar 80mm'
      WHEN 'kitchen'   THEN 'Comanda cocina'
      WHEN 'void'      THEN 'Vale de anulación'
    END,
    _channel, true, 80, default_layout
  ) RETURNING * INTO tpl;

  RETURN tpl;
END $$;

GRANT EXECUTE ON FUNCTION public.pos_receipt_template_resolve(UUID, public.pos_receipt_channel) TO authenticated, service_role;