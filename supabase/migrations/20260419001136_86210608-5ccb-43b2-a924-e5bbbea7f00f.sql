-- Lote 4.1: Scheduling avanzado de productos y promos
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_from timestamp with time zone,
  ADD COLUMN IF NOT EXISTS available_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS available_days smallint[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_time_start time,
  ADD COLUMN IF NOT EXISTS available_time_end time;

COMMENT ON COLUMN public.products.available_from IS
  'Fecha y hora desde la que el producto está disponible. NULL = sin restricción de inicio.';
COMMENT ON COLUMN public.products.available_until IS
  'Fecha y hora hasta la que el producto está disponible. NULL = sin restricción de fin.';
COMMENT ON COLUMN public.products.available_days IS
  'Días de la semana en los que está disponible (0=domingo .. 6=sábado). NULL o vacío = todos los días.';
COMMENT ON COLUMN public.products.available_time_start IS
  'Hora desde la que está disponible cada día (en zona del servidor). NULL = sin restricción.';
COMMENT ON COLUMN public.products.available_time_end IS
  'Hora hasta la que está disponible cada día. NULL = sin restricción.';

CREATE INDEX IF NOT EXISTS products_availability_window_idx
  ON public.products (available_from, available_until)
  WHERE available_from IS NOT NULL OR available_until IS NOT NULL;

-- App settings keys for checkout configurability (Lote 3.3)
INSERT INTO public.app_settings (key, value)
VALUES
  ('checkout_show_delivery_date', 'true'),
  ('checkout_show_time_slot', 'true'),
  ('checkout_show_payment_method', 'true')
ON CONFLICT (key) DO NOTHING;