
-- 1) CUSTOMER REVIEWS: ocultar PII al público vía vista
DROP POLICY IF EXISTS "Approved reviews are public" ON public.customer_reviews;

CREATE OR REPLACE VIEW public.public_customer_reviews
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, order_id, customer_name, rating, comment, admin_response,
       organization_id, created_at, updated_at
FROM public.customer_reviews
WHERE is_approved = true AND is_active = true;

GRANT SELECT ON public.public_customer_reviews TO anon, authenticated;

-- Recreamos la policy pública pero SIN exponer columnas sensibles:
-- en su lugar, el público SOLO lee a través de la vista anterior.
-- La policy original se elimina; la base table queda solo accesible para admins/editores
-- mediante "Admins can manage reviews" y para INSERT vía "Anyone can create reviews".

-- 2) NOTIFICATION SUBSCRIPTIONS: policy restrictiva contra lecturas anónimas
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.notification_subscriptions;

CREATE POLICY "Users manage own subscriptions"
ON public.notification_subscriptions
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny anon reads on subscriptions"
ON public.notification_subscriptions
AS RESTRICTIVE
FOR SELECT TO anon
USING (false);

-- 3) ORDER_ITEMS: restringir INSERT a dueño autenticado o pedido huésped reciente
DROP POLICY IF EXISTS "Order items insertable with order" ON public.order_items;

CREATE POLICY "Order items insertable by owner or fresh guest order"
ON public.order_items
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR (o.user_id IS NULL AND o.created_at > now() - interval '15 minutes')
        OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'agente'::app_role])
      )
  )
);

-- 4) REALTIME: exigir autenticación para suscribirse a canales
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages
FOR SELECT TO authenticated
USING (true);

-- 5) FUNCIONES ADMINISTRATIVAS: revocar EXECUTE a anon/authenticated
REVOKE EXECUTE ON FUNCTION public.create_license(uuid, text, integer, text, text, timestamptz, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_activation(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_catalog_template(uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_invoice_scan(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rematch_invoice_scan(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_usage(uuid, text, text, numeric, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_activation(uuid, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heartbeat_activation(uuid, text) FROM anon, authenticated;
