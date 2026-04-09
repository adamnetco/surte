
-- Municipios
INSERT INTO municipality_settings (city, min_order_amount, is_active) VALUES
  ('Bucaramanga', 120000, true),
  ('Floridablanca', 120000, true),
  ('Girón', 120000, true),
  ('Piedecuesta', 120000, true)
ON CONFLICT DO NOTHING;

-- Featured sections
INSERT INTO featured_sections (label, emoji, filter_type, filter_value, sort_order, is_active) VALUES
  ('Ofertas', '🔥', 'offers', NULL, 0, true),
  ('Mayorista', '💰', 'wholesale', NULL, 1, true),
  ('Minorista', '🌿', 'tag', 'minorista', 2, true),
  ('Combos', '📦', 'combo', NULL, 3, true),
  ('Restaurantes', '🍽️', 'tag', 'restaurante', 4, true),
  ('Comidas Rápidas', '🍔', 'tag', 'comidas-rapidas', 5, true);

-- Landing pages SEO
INSERT INTO landing_pages (slug, title, meta_title, meta_description, heading, body_html, page_type, is_active, sort_order) VALUES
('salsa-de-pina', 'Salsa de Piña al Mayor', 'Salsa de Piña al Mayor en Bucaramanga | SURTÉ YA', 'Compra salsa de piña artesanal al mayor y detal. Directo de fábrica La Unión. Envío gratis +$120.000 en Bucaramanga.', 'Salsa de Piña Artesanal', '<p>Nuestra <strong>salsa de piña</strong> es elaborada con fruta natural en nuestra planta La Unión. Ideal para acompañar carnes, pollo y comidas rápidas.</p><h2>Presentaciones disponibles</h2><ul><li>Salsa de Piña 1 Kg</li><li>Salsa de Piña Galón 3.5 Kg</li><li>Salsa de Piña Bidón 14 Kg</li></ul><h2>¿Por qué elegir SURTÉ YA?</h2><p>Somos fabricantes directos. Sin intermediarios, mejor precio.</p>', 'seo', true, 1),
('pulpas-de-fruta', 'Pulpas de Fruta Naturales', 'Pulpas de Fruta al Mayor en Bucaramanga | SURTÉ YA', 'Pulpas de fruta 100% naturales. Mora, lulo, maracuyá, guanábana y más. Envío gratis en Bucaramanga.', 'Pulpas de Fruta 100% Naturales', '<p>Descubre nuestra línea de <strong>pulpas de fruta</strong> elaboradas con fruta seleccionada. Sin conservantes artificiales.</p><h2>Sabores disponibles</h2><ul><li>Mora</li><li>Lulo</li><li>Maracuyá</li><li>Guanábana</li><li>Mango</li><li>Limonada de Coco</li></ul>', 'seo', true, 2),
('carnicos-al-mayor', 'Cárnicos al Mayor', 'Cárnicos al Mayor en Bucaramanga | SURTÉ YA', 'Cárnicos al mayor y detal: carne para hamburguesa, milanesas, pollo desmechado. Envío gratis en Bucaramanga.', 'Cárnicos al Mayor y Detal', '<p>Amplio portafolio de <strong>cárnicos</strong> para tu negocio HORECA. Hamburguesas, milanesas, filetes y más.</p>', 'seo', true, 3),
('salsa-tartara', 'Salsa Tártara Artesanal', 'Salsa Tártara al Mayor en Bucaramanga | SURTÉ YA', 'Salsa tártara artesanal al mayor. Ideal para restaurantes y comidas rápidas. Envío gratis +$120.000.', 'Salsa Tártara Artesanal', '<p>La mejor <strong>salsa tártara</strong> del mercado, elaborada artesanalmente en nuestra planta La Unión.</p>', 'seo', true, 4),
('proveedores-restaurantes-bucaramanga', 'Proveedores para Restaurantes', 'Proveedor de Restaurantes en Bucaramanga | SURTÉ YA', 'Somos tu proveedor ideal para restaurantes en Bucaramanga. Salsas, cárnicos y pulpas al mejor precio.', 'Tu Proveedor HORECA de Confianza', '<p>En <strong>SURTÉ YA</strong> somos el aliado perfecto para restaurantes, hoteles y cafeterías en Bucaramanga y su área metropolitana.</p>', 'seo', true, 5),
('comidas-rapidas-insumos', 'Insumos para Comidas Rápidas', 'Insumos para Comidas Rápidas en Bucaramanga | SURTÉ YA', 'Todo lo que necesitas para tu negocio de comidas rápidas. Salsas, cárnicos y más al mayor.', 'Insumos para Comidas Rápidas', '<p>Equipa tu negocio de <strong>comidas rápidas</strong> con los mejores insumos directo de fábrica.</p>', 'seo', true, 6),
('distribuidor-salsas-santander', 'Distribuidor de Salsas en Santander', 'Distribuidor de Salsas en Santander | SURTÉ YA', 'Distribución de salsas artesanales en Santander. Tártara, piña, rosada y más. Precios de fábrica.', 'Distribución de Salsas en Santander', '<p>Somos fabricantes y distribuidores de <strong>salsas artesanales</strong> en todo el departamento de Santander.</p>', 'seo', true, 7),
('hamburguesas-al-mayor', 'Carne para Hamburguesa al Mayor', 'Carne para Hamburguesa al Mayor | SURTÉ YA', 'Carne para hamburguesa al mayor en Bucaramanga. Diferentes gramajes. Envío gratis +$120.000.', 'Carne para Hamburguesa al Mayor', '<p>Las mejores <strong>carnes para hamburguesa</strong> del mercado, elaboradas con cortes seleccionados.</p>', 'seo', true, 8),
('milanesas-al-mayor', 'Milanesas al Mayor', 'Milanesas de Pollo al Mayor en Bucaramanga | SURTÉ YA', 'Milanesas de pollo al mayor. Cryspi y tradicional. Ideales para restaurantes y comidas rápidas.', 'Milanesas de Pollo al Mayor', '<p>Nuestras <strong>milanesas de pollo</strong> son el producto estrella para negocios de comidas rápidas.</p>', 'seo', true, 9),
('pedidos-por-whatsapp', 'Pedidos por WhatsApp', 'Pedidos por WhatsApp en Bucaramanga | SURTÉ YA', 'Haz tu pedido fácil y rápido por WhatsApp. Salsas, cárnicos y pulpas con envío gratis en Bucaramanga.', 'Pedidos Fáciles por WhatsApp', '<p>En <strong>SURTÉ YA</strong> puedes hacer tu pedido directamente por WhatsApp de forma rápida y sencilla.</p>', 'seo', true, 10)
ON CONFLICT (slug) DO NOTHING;

-- App settings faltantes
INSERT INTO app_settings (key, value) VALUES
  ('trust_card_shipping_title', 'Envío Gratis'),
  ('trust_card_shipping_sub', '+{min_order}'),
  ('trust_card_payment_title', 'Pago Seguro'),
  ('trust_card_payment_sub', 'Contraentrega'),
  ('trust_card_quality_title', 'Calidad'),
  ('trust_card_quality_sub', 'Garantizada'),
  ('product_default_image_url', ''),
  ('estimated_delivery_days', '1-2'),
  ('seo_site_name', 'SURTÉ YA - Soluciones Alimenticias'),
  ('seo_default_description', 'Salsas, cárnicos y pulpas al mayor en Bucaramanga. Directo de fábrica a tu negocio.'),
  ('seo_google_merchant_id', ''),
  ('seo_facebook_pixel_id', ''),
  ('seo_facebook_catalog_id', ''),
  ('social_tiktok', '')
ON CONFLICT (key) DO NOTHING;
