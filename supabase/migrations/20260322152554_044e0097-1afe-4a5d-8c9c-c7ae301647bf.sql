
-- RLS policy: Editors can only read orders
CREATE POLICY "Editors can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'editor'::app_role));

-- RLS policy: Editors can manage products (CRUD)
CREATE POLICY "Editors can manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'editor'::app_role));

-- RLS policy: Editors can view categories (needed for product editing)
CREATE POLICY "Editors can view categories"
ON public.categories
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'editor'::app_role));
