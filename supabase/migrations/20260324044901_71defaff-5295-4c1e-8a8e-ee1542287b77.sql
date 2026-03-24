
-- Shipping zones table for neighborhood-based delivery pricing
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL DEFAULT 'Bucaramanga',
  neighborhood text NOT NULL,
  delivery_price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping zones viewable by everyone"
ON public.shipping_zones FOR SELECT
USING (true);

CREATE POLICY "Admins can manage shipping zones"
ON public.shipping_zones FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add 'casa' to business_type enum
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'casa';
