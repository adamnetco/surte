ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token uuid;

UPDATE public.orders
SET tracking_token = gen_random_uuid()
WHERE tracking_token IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN tracking_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_uidx
  ON public.orders (tracking_token);

DROP POLICY IF EXISTS "Admins manage non-superadmin roles" ON public.user_roles;

DROP POLICY IF EXISTS wa_events_order_tracking_select ON public.whatsapp_message_events;

CREATE OR REPLACE FUNCTION public.get_order_tracking(
  p_order_number integer,
  p_tracking_token uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'order', to_jsonb(o) - 'tracking_token' - 'whatsapp_ref',
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.id)
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'order_id', e.order_id,
          'status', e.status,
          'error', e.error,
          'created_at', e.created_at
        ) ORDER BY e.created_at
      )
      FROM public.whatsapp_message_events e
      WHERE e.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.order_number = p_order_number
    AND o.tracking_token = p_tracking_token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_order_tracking(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(integer, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_order_tracking(integer, uuid)
IS 'Returns one order and a redacted tracking timeline only when number and opaque tracking token match.';