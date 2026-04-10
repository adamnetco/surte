INSERT INTO public.featured_sections (id, emoji, filter_type, filter_value, is_active, label, sort_order)
VALUES
  ('4a1a6aad-ae7f-46ad-85aa-3db878b50d6b', '🔥', 'offers', NULL, true, 'Ofertas', 0),
  ('0b46fb0a-5bf8-4c14-9a68-c22499b8bb70', '💰', 'wholesale', NULL, true, 'Mayorista', 1),
  ('1326ce1c-6618-464e-bbb1-d0f1edd0f1c6', '🛒', 'tag', 'minorista', true, 'Minorista', 2),
  ('52b79e6c-dcc4-4cff-abda-6463ba405f66', '📦', 'combo', NULL, true, 'Combos', 3),
  ('0de2d4b5-0d41-4d47-94d8-4c60f5e28556', '🍽️', 'tag', 'restaurante', true, 'Restaurantes', 4),
  ('22efc48d-2ecc-41b8-8dd7-557bde25cf80', '🍔', 'tag', 'comidas-rapidas', true, 'Comidas Rápidas', 5)
ON CONFLICT (id) DO NOTHING;