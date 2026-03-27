ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_price numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_zone_id uuid NULL REFERENCES public.shipping_zones(id) ON DELETE SET NULL;