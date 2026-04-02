CREATE POLICY "Anyone can view orders by order_number"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can view order items for visible orders"
ON public.order_items
FOR SELECT
TO anon, authenticated
USING (true);