
CREATE TABLE public.landing_page_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (landing_page_id, product_id)
);

CREATE INDEX idx_landing_page_products_lp ON public.landing_page_products(landing_page_id);
CREATE INDEX idx_landing_page_products_prod ON public.landing_page_products(product_id);

ALTER TABLE public.landing_page_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view landing page products"
ON public.landing_page_products
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage landing page products"
ON public.landing_page_products
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]));
