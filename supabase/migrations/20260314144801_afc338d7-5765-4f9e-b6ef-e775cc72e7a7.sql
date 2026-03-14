
-- Fix: restrict order creation to authenticated users or with valid data
DROP POLICY "Users can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (
  customer_name IS NOT NULL AND customer_phone IS NOT NULL AND total > 0
);

DROP POLICY "Order items insertable with order" ON public.order_items;
CREATE POLICY "Order items insertable with order" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id)
);
