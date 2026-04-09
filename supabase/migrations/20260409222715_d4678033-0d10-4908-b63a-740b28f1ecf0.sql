-- Clean duplicates: keep only one row per label
DELETE FROM featured_sections a
USING featured_sections b
WHERE a.label = b.label AND a.id::text > b.id::text;

-- Create unique index on label to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_sections_label ON featured_sections(label);

-- Seed data (will be applied to Live on publish)
INSERT INTO featured_sections (label, emoji, filter_type, filter_value, is_active, sort_order)
VALUES
  ('Ofertas', '🔥', 'offers', NULL, true, 0),
  ('Mayorista', '💰', 'wholesale', NULL, true, 1),
  ('Minorista', '🛒', 'tag', 'minorista', true, 2),
  ('Combos', '📦', 'combo', NULL, true, 3),
  ('Restaurantes', '🍽️', 'tag', 'restaurante', true, 4),
  ('Comidas Rápidas', '🍔', 'tag', 'comidas-rapidas', true, 5)
ON CONFLICT (label) DO NOTHING;
