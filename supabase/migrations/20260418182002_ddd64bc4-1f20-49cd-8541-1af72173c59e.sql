-- 1. municipality_settings: free shipping toggle + threshold
ALTER TABLE public.municipality_settings
  ADD COLUMN IF NOT EXISTS free_shipping_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric NOT NULL DEFAULT 100000;

COMMENT ON COLUMN public.municipality_settings.free_shipping_enabled IS
  'Si está activo, los pedidos que superen free_shipping_threshold tienen domicilio gratis en este municipio.';
COMMENT ON COLUMN public.municipality_settings.free_shipping_threshold IS
  'Monto mínimo de compra (subtotal) para que el domicilio sea gratuito.';

-- 2. orders: payment tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_recorded_at timestamp with time zone;

-- Validation: payment_status must be one of allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pendiente', 'pagado', 'parcial', 'reembolsado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders (payment_status);

COMMENT ON COLUMN public.orders.payment_status IS
  'Estado del pago: pendiente | pagado | parcial | reembolsado';
COMMENT ON COLUMN public.orders.amount_paid IS
  'Monto efectivamente recibido. Para pagos parciales, el saldo = total - amount_paid.';