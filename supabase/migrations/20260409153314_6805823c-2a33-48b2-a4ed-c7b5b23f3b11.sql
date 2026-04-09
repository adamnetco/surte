
-- Dynamic featured sections for homepage
CREATE TABLE public.featured_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  emoji TEXT DEFAULT '⭐',
  filter_type TEXT NOT NULL DEFAULT 'tag',
  filter_value TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_sections ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can view active featured sections"
  ON public.featured_sections FOR SELECT
  USING (true);

-- Admin CRUD
CREATE POLICY "Admins can manage featured sections"
  ON public.featured_sections FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-update timestamp
CREATE TRIGGER update_featured_sections_updated_at
  BEFORE UPDATE ON public.featured_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default sections
INSERT INTO public.featured_sections (label, emoji, filter_type, filter_value, sort_order) VALUES
  ('Ofertas', '🔥', 'offers', NULL, 0),
  ('Mayorista', '💰', 'wholesale', NULL, 1),
  ('Frescos', '🌿', 'fresh', NULL, 2),
  ('Combos', '📦', 'combo', NULL, 3),
  ('Restaurantes', '🍽️', 'tag', 'restaurante', 4),
  ('Comidas Rápidas', '🍔', 'tag', 'comidas-rapidas', 5);
