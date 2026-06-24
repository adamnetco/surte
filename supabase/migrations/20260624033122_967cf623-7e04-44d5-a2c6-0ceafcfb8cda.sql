-- Wave 1: POS Innapsis Emission UX (POS-innapsis-emision-pos)

-- pos_orders: tipo de documento DIAN elegido al cobrar
ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS einvoice_doc_type TEXT
    DEFAULT 'pos_electronico'
    CHECK (einvoice_doc_type IN ('factura_electronica','pos_electronico','doc_soporte','sin_dian'));

COMMENT ON COLUMN public.pos_orders.einvoice_doc_type IS
  'Tipo de documento DIAN seleccionado al cobrar. Default pos_electronico para Consumidor Final.';

-- einvoice_configs: comportamiento POS, contingencia y salud DIAN
ALTER TABLE public.einvoice_configs
  ADD COLUMN IF NOT EXISTS pos_behavior JSONB NOT NULL DEFAULT jsonb_build_object(
    'default_doc_type','pos_electronico',
    'ask_on_each_sale', false,
    'auto_send_email', true,
    'auto_send_whatsapp', false
  ),
  ADD COLUMN IF NOT EXISTS contingency_range JSONB,
  ADD COLUMN IF NOT EXISTS dian_health_status TEXT NOT NULL DEFAULT 'online'
    CHECK (dian_health_status IN ('online','degraded','offline'));

COMMENT ON COLUMN public.einvoice_configs.pos_behavior IS
  'Preferencias UX del cajero: default_doc_type, ask_on_each_sale, auto_send_email, auto_send_whatsapp.';
COMMENT ON COLUMN public.einvoice_configs.contingency_range IS
  'Rango DIAN pre-autorizado para modo contingencia. Estructura: {prefix, from, to, current, resolution_date}.';
COMMENT ON COLUMN public.einvoice_configs.dian_health_status IS
  'Salud DIAN agregada del último check (cron 5min): online | degraded | offline.';

-- Índice para feed en vivo del cajero por turno (AC15)
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_pos_recent
  ON public.electronic_invoices (organization_id, created_at DESC)
  WHERE pos_order_id IS NOT NULL;