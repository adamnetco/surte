DO $$
DECLARE
  v_org uuid := '59a4032f-3eeb-4312-a84a-f6d042f019ec';
  v_loc uuid;
  v_area uuid;
  v_cat_bebidas uuid;
  v_cat_snacks uuid;
  v_cat_panaderia uuid;
BEGIN
  INSERT INTO public.organization_modules (organization_id, module_key, enabled)
  VALUES
    (v_org, 'retail', true), (v_org, 'pos', true), (v_org, 'kds', true),
    (v_org, 'mesas', true), (v_org, 'inventario', true), (v_org, 'crm', true),
    (v_org, 'licencias', true)
  ON CONFLICT (organization_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled;

  INSERT INTO public.locations (organization_id, name, code, address, city, is_main, is_active)
  VALUES (v_org, 'Sede Demo Centro', 'DEMO-01', 'Cra 27 #36-15', 'Bucaramanga', true, true)
  ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_loc;
  IF v_loc IS NULL THEN
    SELECT id INTO v_loc FROM public.locations WHERE organization_id = v_org AND code = 'DEMO-01';
  END IF;

  INSERT INTO public.cash_registers (organization_id, location_id, name, code, is_active)
  SELECT v_org, v_loc, 'Caja 1', 'CAJA-01', true
  WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE location_id = v_loc AND code = 'CAJA-01');

  INSERT INTO public.kitchen_stations (organization_id, location_id, name, is_active)
  SELECT v_org, v_loc, 'Cocina principal', true
  WHERE NOT EXISTS (SELECT 1 FROM public.kitchen_stations WHERE location_id = v_loc AND name = 'Cocina principal');

  INSERT INTO public.dining_areas (organization_id, location_id, name, is_active)
  SELECT v_org, v_loc, 'Salón principal', true
  WHERE NOT EXISTS (SELECT 1 FROM public.dining_areas WHERE location_id = v_loc AND name = 'Salón principal')
  RETURNING id INTO v_area;
  IF v_area IS NULL THEN
    SELECT id INTO v_area FROM public.dining_areas WHERE location_id = v_loc AND name = 'Salón principal';
  END IF;

  INSERT INTO public.dining_tables (organization_id, location_id, dining_area_id, label, capacity, is_active)
  SELECT v_org, v_loc, v_area, 'Mesa ' || n, 4, true
  FROM generate_series(1,4) n
  WHERE NOT EXISTS (SELECT 1 FROM public.dining_tables WHERE dining_area_id = v_area AND label = 'Mesa ' || n);

  INSERT INTO public.categories (organization_id, name, slug) VALUES (v_org, 'Bebidas', 'demo-bebidas')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_bebidas;
  INSERT INTO public.categories (organization_id, name, slug) VALUES (v_org, 'Snacks', 'demo-snacks')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_snacks;
  INSERT INTO public.categories (organization_id, name, slug) VALUES (v_org, 'Panadería', 'demo-panaderia')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_panaderia;

  INSERT INTO public.products (organization_id, category_id, name, slug, price, cost_price, stock, sku)
  VALUES
    (v_org, v_cat_bebidas,   'Café Americano',     'demo-cafe-americano',   4500, 1800, 100, 'DEMO-001'),
    (v_org, v_cat_bebidas,   'Capuccino',          'demo-capuccino',        6500, 2500, 100, 'DEMO-002'),
    (v_org, v_cat_bebidas,   'Jugo Natural',       'demo-jugo-natural',     7000, 2800, 80,  'DEMO-003'),
    (v_org, v_cat_bebidas,   'Agua 500ml',         'demo-agua-500',         3000, 1200, 200, 'DEMO-004'),
    (v_org, v_cat_snacks,    'Empanada de carne',  'demo-empanada-carne',   3500, 1500, 60,  'DEMO-005'),
    (v_org, v_cat_snacks,    'Empanada de pollo',  'demo-empanada-pollo',   3500, 1500, 60,  'DEMO-006'),
    (v_org, v_cat_snacks,    'Sandwich Club',      'demo-sandwich-club',   12500, 5500, 30,  'DEMO-007'),
    (v_org, v_cat_panaderia, 'Croissant',          'demo-croissant',        4800, 2000, 40,  'DEMO-008'),
    (v_org, v_cat_panaderia, 'Pan de Bono',        'demo-pan-bono',         2500, 1000, 80,  'DEMO-009'),
    (v_org, v_cat_panaderia, 'Torta de chocolate', 'demo-torta-chocolate',  8500, 3500, 25,  'DEMO-010')
  ON CONFLICT (slug) DO NOTHING;
END $$;