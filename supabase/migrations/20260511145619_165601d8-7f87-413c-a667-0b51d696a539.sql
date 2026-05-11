
-- Persistent omnichannel cart
CREATE TABLE public.persistent_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_persistent_carts_token ON public.persistent_carts(cart_token);
CREATE INDEX idx_persistent_carts_phone ON public.persistent_carts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_persistent_carts_user ON public.persistent_carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_persistent_carts_active ON public.persistent_carts(status, expires_at);

ALTER TABLE public.persistent_carts ENABLE ROW LEVEL SECURITY;

-- Only admins can directly query the table (PII protection)
CREATE POLICY "Admins manage persistent_carts"
ON public.persistent_carts FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role]));

-- Owner (logged-in) read access
CREATE POLICY "Users read own carts"
ON public.persistent_carts FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE TRIGGER trg_persistent_carts_updated_at
BEFORE UPDATE ON public.persistent_carts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RPC: upsert by token (public, used by web & WhatsApp Flow webhook)
CREATE OR REPLACE FUNCTION public.upsert_persistent_cart(
  _cart_token uuid,
  _items jsonb,
  _subtotal numeric,
  _total_items integer,
  _phone text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _channel text DEFAULT 'web',
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.persistent_carts AS c
    (cart_token, items, subtotal, total_items, phone, user_id, channel, metadata, last_activity_at, expires_at)
  VALUES
    (_cart_token, COALESCE(_items,'[]'::jsonb), COALESCE(_subtotal,0), COALESCE(_total_items,0),
     NULLIF(regexp_replace(COALESCE(_phone,''), '\D', '', 'g'), ''),
     _user_id, COALESCE(_channel,'web'), COALESCE(_metadata,'{}'::jsonb),
     now(), now() + interval '7 days')
  ON CONFLICT (cart_token) DO UPDATE SET
    items = EXCLUDED.items,
    subtotal = EXCLUDED.subtotal,
    total_items = EXCLUDED.total_items,
    phone = COALESCE(EXCLUDED.phone, c.phone),
    user_id = COALESCE(EXCLUDED.user_id, c.user_id),
    channel = EXCLUDED.channel,
    metadata = c.metadata || EXCLUDED.metadata,
    last_activity_at = now(),
    expires_at = now() + interval '7 days',
    status = 'active'
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── RPC: read by token
CREATE OR REPLACE FUNCTION public.get_persistent_cart(_cart_token uuid)
RETURNS TABLE(
  cart_token uuid,
  items jsonb,
  subtotal numeric,
  total_items integer,
  phone text,
  user_id uuid,
  channel text,
  status text,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cart_token, items, subtotal, total_items, phone, user_id, channel, status, updated_at
  FROM public.persistent_carts
  WHERE cart_token = _cart_token AND status = 'active' AND expires_at > now()
  LIMIT 1;
$$;

-- ── RPC: mark cart as completed (after order created)
CREATE OR REPLACE FUNCTION public.complete_persistent_cart(_cart_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.persistent_carts
     SET status = 'completed', last_activity_at = now()
   WHERE cart_token = _cart_token;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_persistent_cart(uuid,jsonb,numeric,integer,text,uuid,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_persistent_cart(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_persistent_cart(uuid) TO anon, authenticated;

-- Enable realtime for owner-side hydration
ALTER TABLE public.persistent_carts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.persistent_carts;
