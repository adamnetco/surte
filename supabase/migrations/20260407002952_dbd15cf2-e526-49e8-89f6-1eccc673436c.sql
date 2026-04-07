-- Coupons table
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  max_uses integer DEFAULT NULL,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coupons readable by everyone" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role])) WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

-- Product presentations table
CREATE TABLE public.product_presentations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  conversion_factor numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  weight_kg numeric DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presentations readable by everyone" ON public.product_presentations FOR SELECT USING (true);
CREATE POLICY "Admins can manage presentations" ON public.product_presentations FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role])) WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]));

CREATE INDEX idx_presentations_product ON public.product_presentations(product_id);

-- Custom scripts table
CREATE TABLE public.custom_scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  script_content text NOT NULL,
  position text NOT NULL DEFAULT 'head' CHECK (position IN ('head', 'body_start', 'body_end')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scripts readable by everyone" ON public.custom_scripts FOR SELECT USING (true);
CREATE POLICY "Admins can manage scripts" ON public.custom_scripts FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role])) WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

-- Add base_unit to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_unit text DEFAULT 'unidad';

-- Triggers for updated_at
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_presentations_updated_at BEFORE UPDATE ON public.product_presentations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.custom_scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();