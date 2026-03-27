CREATE POLICY "Editors can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors can view order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['editor'::app_role]));