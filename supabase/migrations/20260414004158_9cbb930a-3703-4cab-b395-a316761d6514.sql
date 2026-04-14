-- Fix: Orders - drop old public + update existing
DROP POLICY IF EXISTS "Anyone can view orders by order_number" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

CREATE POLICY "Users can view own orders"
ON public.orders FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_any_role(auth.uid(), ARRAY['admin','superadmin','agente']::app_role[])
);

-- Fix: Order items
DROP POLICY IF EXISTS "Anyone can view order items for visible orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;

CREATE POLICY "Users can view own order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND (o.user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','superadmin','agente']::app_role[]))
  )
);

-- Fix: Coupons
DROP POLICY IF EXISTS "Coupons are publicly readable" ON public.coupons;
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;

CREATE POLICY "Authenticated can view active coupons"
ON public.coupons FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

-- Fix: Custom scripts
DROP POLICY IF EXISTS "Custom scripts are publicly readable" ON public.custom_scripts;
DROP POLICY IF EXISTS "Anyone can view active scripts" ON public.custom_scripts;
DROP POLICY IF EXISTS "Active scripts readable by all" ON public.custom_scripts;
DROP POLICY IF EXISTS "Admins manage scripts" ON public.custom_scripts;

CREATE POLICY "Active scripts readable by all"
ON public.custom_scripts FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins manage scripts"
ON public.custom_scripts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','superadmin','editor']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','superadmin','editor']::app_role[]));