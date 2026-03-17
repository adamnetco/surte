
-- Seed categories
INSERT INTO public.categories (name, slug, icon, color, sort_order) VALUES
  ('Cárnicos', 'carnicos', 'Drumstick', '#C0392B', 1),
  ('Pulpas', 'pulpas', 'Cherry', '#E91E63', 2),
  ('Agua', 'agua', 'Droplets', '#2196F3', 3),
  ('Salsas', 'salsas', 'Flame', '#FF9800', 4),
  ('Panificados', 'panificados', 'Croissant', '#795548', 5)
ON CONFLICT DO NOTHING;

-- Seed products
INSERT INTO public.products (name, description, price, original_price, stock, unit, category_id, is_fresh, is_wholesale) VALUES
  ('Alotas de Pollo SURTÉ', 'Alotas de pollo frescas, empacadas al vacío. Ideales para restaurantes y hoteles.', 12500, 15000, 150, 'kg', (SELECT id FROM public.categories WHERE slug = 'carnicos'), true, true),
  ('Pechuga de Pollo SURTÉ', 'Pechuga deshuesada premium, corte uniforme para tu negocio.', 14800, NULL, 200, 'kg', (SELECT id FROM public.categories WHERE slug = 'carnicos'), true, true),
  ('Muslos de Pollo SURTÉ', 'Muslos frescos seleccionados, empaque al vacío.', 11500, NULL, 180, 'kg', (SELECT id FROM public.categories WHERE slug = 'carnicos'), true, true),
  ('Pulpa de Fruta Mango', 'Pulpa 100% natural de mango, sin conservantes ni azúcar añadida.', 8500, 9500, 80, '500g', (SELECT id FROM public.categories WHERE slug = 'pulpas'), true, false),
  ('Pulpa de Fruta Mora', 'Pulpa natural de mora, ideal para jugos, batidos y postres.', 7800, NULL, 120, '500g', (SELECT id FROM public.categories WHERE slug = 'pulpas'), true, false),
  ('Pulpa de Fruta Guanábana', 'Pulpa de guanábana premium, textura cremosa.', 9200, NULL, 60, '500g', (SELECT id FROM public.categories WHERE slug = 'pulpas'), true, false),
  ('Agua Natural SURTÉ 600ml', 'Agua purificada, presentación personal.', 1200, NULL, 500, 'unidad', (SELECT id FROM public.categories WHERE slug = 'agua'), false, true),
  ('Agua Natural SURTÉ 5L', 'Agua purificada, presentación familiar.', 5500, NULL, 300, 'unidad', (SELECT id FROM public.categories WHERE slug = 'agua'), false, true),
  ('Salsa BBQ SURTÉ', 'Salsa BBQ artesanal con sabor ahumado intenso.', 6200, 7000, 90, '350ml', (SELECT id FROM public.categories WHERE slug = 'salsas'), false, false),
  ('Salsa de Tomate SURTÉ', 'Salsa de tomate natural sin conservantes.', 4500, NULL, 200, '400g', (SELECT id FROM public.categories WHERE slug = 'salsas'), false, true),
  ('Pan Tajado Integral', 'Pan integral tajado, horneado diariamente en La Unión.', 5800, NULL, 60, '500g', (SELECT id FROM public.categories WHERE slug = 'panificados'), true, false),
  ('Mogolla Artesanal x6', 'Mogollas artesanales frescas, paquete por 6 unidades.', 4200, NULL, 45, 'paquete', (SELECT id FROM public.categories WHERE slug = 'panificados'), true, false);

-- Seed banners
INSERT INTO public.banners (title, subtitle, cta_text, cta_link, sort_order) VALUES
  ('Precios de Fábrica', 'Cárnicos, pulpas y más directo del productor a tu negocio', 'Ver Catálogo', '/catalogo', 1),
  ('Envío Gratis', 'En compras desde $40.000 en Medellín y Área Metropolitana', 'Comprar Ahora', '/catalogo', 2),
  ('Ofertas de la Semana', 'Hasta 20% de descuento en productos seleccionados', 'Ver Ofertas', '/ofertas', 3);

-- Seed testimonials
INSERT INTO public.testimonials (customer_name, customer_city, content, rating, sort_order) VALUES
  ('María González', 'Medellín', 'Excelente calidad en sus cárnicos. Los precios mayoristas nos han ayudado a reducir costos en el restaurante. Entregas siempre puntuales.', 5, 1),
  ('Carlos Pérez', 'Envigado', 'Las pulpas de fruta son las mejores del mercado. 100% naturales y con un sabor increíble. Mi tienda las vende como pan caliente.', 5, 2),
  ('Ana Martínez', 'Bello', 'Llevamos 6 meses comprando con SURTÉ y la consistencia en calidad y precio es impecable. Totalmente recomendados para HORECA.', 4, 3);

-- Seed app settings
INSERT INTO public.app_settings (key, value) VALUES
  ('min_order_amount', '40000'),
  ('whatsapp_number', '573000000000'),
  ('store_name', 'SURTÉ - Soluciones Alimenticias'),
  ('delivery_zones', 'Medellín y Área Metropolitana')
ON CONFLICT DO NOTHING;
