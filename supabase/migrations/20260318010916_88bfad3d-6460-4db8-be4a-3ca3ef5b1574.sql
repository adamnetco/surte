
-- Brands table
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands viewable by everyone" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Admins can manage brands" ON public.brands FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add price tiers visibility setting
INSERT INTO public.app_settings (key, value) VALUES ('show_price_tiers', 'true') ON CONFLICT DO NOTHING;
