
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pos_enabled_modes text[] NOT NULL DEFAULT ARRAY['mesa','autoservicio','domicilio','consumo_interno']::text[],
  ADD COLUMN IF NOT EXISTS pos_default_mode text NOT NULL DEFAULT 'autoservicio';

COMMENT ON COLUMN public.organizations.pos_enabled_modes IS 'Modos de venta habilitados en el POS para esta organización (mesa, autoservicio, domicilio, consumo_interno). Configurable según el nicho del negocio.';
COMMENT ON COLUMN public.organizations.pos_default_mode IS 'Modo de venta por defecto al abrir el POS.';

ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS sale_mode text NOT NULL DEFAULT 'autoservicio';

CREATE INDEX IF NOT EXISTS idx_pos_orders_sale_mode ON public.pos_orders(sale_mode);
