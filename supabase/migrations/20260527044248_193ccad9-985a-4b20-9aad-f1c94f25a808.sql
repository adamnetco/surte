ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS client_uuid uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pos_orders_client_uuid_uidx ON public.pos_orders (client_uuid) WHERE client_uuid IS NOT NULL;