-- Add advanced checkout columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS preferred_delivery_date date,
  ADD COLUMN IF NOT EXISTS preferred_time_slot text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'efectivo';

-- Insert estimated delivery days setting
INSERT INTO public.app_settings (key, value)
VALUES ('estimated_delivery_days', '1-2')
ON CONFLICT (key) DO NOTHING;