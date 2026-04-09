
-- =============================================
-- SEED: Municipality Settings
-- =============================================
INSERT INTO municipality_settings (city, min_order_amount, is_active) VALUES
('Bucaramanga', 120000, true),
('Floridablanca', 120000, true),
('Girón', 120000, true),
('Piedecuesta', 120000, true)
ON CONFLICT (city) DO NOTHING;

-- =============================================
-- SEED: Featured Sections
-- =============================================
INSERT INTO featured_sections (label, emoji, filter_type, filter_value, sort_order, is_active) VALUES
('Ofertas', '🔥', 'offers', NULL, 0, true),
('Mayorista', '💰', 'wholesale', NULL, 1, true),
('Minorista', '🌿', 'tag', 'minorista', 2, true),
('Combos', '📦', 'combo', NULL, 3, true),
('Restaurantes', '🍽️', 'tag', 'restaurante', 4, true),
('Comidas Rápidas', '🍔', 'tag', 'comidas-rapidas', 5, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED: Landing Pages (SEO)
-- =============================================
INSERT INTO landing_pages (slug, title, meta_title, meta_description, heading, body_html, city, page_type, is_active, sort_order) VALUES
('salsa-de-pina-mayorista-bucaramanga',
 'Salsa de Piña al por Mayor en Bucaramanga',
 'Salsa de Piña al por Mayor en Bucaramanga | SURTÉ YA',
 'Compra salsa de piña artesanal al por mayor en Bucaramanga. Precios especiales para restaurantes, hoteles y negocios HORECA. Envío a domicilio en el área metropolitana.',
 'Salsa de Piña Artesanal al por Mayor',
 '<h2>La Mejor Salsa de Piña para tu Negocio</h2><p>En <strong>SURTÉ YA</strong> somos distribuidores mayoristas de salsa de piña artesanal en Bucaramanga y su área metropolitana. Nuestra salsa de piña es elaborada con fruta fresca seleccionada, ideal para restaurantes, hoteles, casinos y establecimientos del sector HORECA.</p><h3>¿Por qué elegir nuestra Salsa de Piña?</h3><ul><li>🍍 Elaborada con piña fresca de la región</li><li>💰 Precios mayoristas competitivos</li><li>🚚 Envío a domicilio en Bucaramanga, Floridablanca, Girón y Piedecuesta</li><li>📦 Presentaciones desde 250g hasta galón</li><li>✅ Registro sanitario vigente</li></ul><h3>Precios Mayoristas</h3><p>Ofrecemos descuentos por volumen para negocios que compran de forma recurrente. Contáctanos por WhatsApp para cotizar tu pedido personalizado.</p><h3>Cobertura de Entrega</h3><p>Realizamos entregas en todo el área metropolitana de Bucaramanga: Floridablanca, Girón y Piedecuesta. Pedido mínimo aplica según tu zona.</p>',
 'Bucaramanga', 'seo', true, 0),

('salsa-tartara-mayorista-bucaramanga',
 'Salsa Tártara al por Mayor en Bucaramanga',
 'Salsa Tártara al por Mayor en Bucaramanga | SURTÉ YA',
 'Distribuidores de salsa tártara al por mayor en Bucaramanga. Calidad premium para restaurantes y negocios HORECA. Entrega a domicilio en el área metropolitana.',
 'Salsa Tártara Premium al por Mayor',
 '<h2>Salsa Tártara Premium para Profesionales</h2><p><strong>SURTÉ YA</strong> es tu proveedor de confianza de salsa tártara al por mayor en Bucaramanga. Nuestra salsa tártara es la elección preferida de chefs y restaurantes en Santander por su sabor auténtico y textura cremosa.</p><h3>Características de Nuestra Salsa Tártara</h3><ul><li>🐟 Perfecta para acompañar pescados, mariscos y frituras</li><li>🧑‍🍳 Fórmula profesional preferida por chefs</li><li>💰 Precios especiales al por mayor</li><li>🚚 Entrega rápida en el área metropolitana</li><li>📦 Presentaciones de 250g, 500g, 1kg y galón</li></ul><h3>Ideal para el Sector HORECA</h3><p>Restaurantes, hoteles, casinos y servicios de catering confían en SURTÉ YA como su proveedor de salsas. Garantizamos frescura, consistencia en el sabor y los mejores precios del mercado.</p><h3>Zona de Cobertura</h3><p>Entregamos en Bucaramanga, Floridablanca, Girón y Piedecuesta. Consulta nuestro pedido mínimo y costos de domicilio según tu ubicación.</p>',
 'Bucaramanga', 'seo', true, 0),

('salsas-al-por-mayor-bucaramanga',
 'Salsas al por Mayor en Bucaramanga',
 'Salsas al por Mayor Bucaramanga | SURTÉ YA — Precios de Fábrica',
 'Compra salsas al por mayor en Bucaramanga con precios de fábrica. Salsa de piña, tártara, BBQ y más. Envíos a todo Santander. Pedidos por WhatsApp.',
 'Salsas al por Mayor — Precios de Fábrica en Bucaramanga',
 '<p>En <strong>SURTÉ YA</strong> somos distribuidores autorizados de <strong>La Unión</strong>, la fábrica líder en producción de salsas artesanales en Santander. Ofrecemos precios mayoristas directos de fábrica sin intermediarios.</p><h2>¿Por qué comprar salsas al por mayor con nosotros?</h2><ul><li>Precios directos de fábrica La Unión</li><li>Envíos a Bucaramanga, Floridablanca, Girón y Piedecuesta</li><li>Atención personalizada por WhatsApp</li><li>Variedad: Salsa de Piña, Tártara, BBQ, Rosada, Ají y más</li></ul><p>Ideal para restaurantes, hoteles, catering, minimercados y distribuidores del sector HORECA en Santander.</p>',
 'Bucaramanga', 'keyword', true, 1),

('pulpas-de-fruta-mayorista-bucaramanga',
 'Pulpas de Fruta al por Mayor en Bucaramanga',
 'Pulpas de Fruta Mayorista Bucaramanga | SURTÉ YA',
 'Pulpas de fruta 100% naturales al por mayor en Bucaramanga. Maracuyá, mango, lulo, guanábana y más. Envíos a domicilio en Santander.',
 'Pulpas de Fruta Naturales — Mayorista Bucaramanga',
 '<p>Distribuimos <strong>pulpas de fruta 100% naturales</strong> al por mayor en Bucaramanga y toda el área metropolitana. Producto fresco, sin conservantes artificiales, directo de fábrica.</p><h2>Sabores disponibles</h2><ul><li>Maracuyá</li><li>Mango</li><li>Lulo</li><li>Guanábana</li><li>Mora</li><li>Fresa</li></ul><p>Perfecto para juguerías, restaurantes, hoteles y negocios del sector alimentos en Santander.</p>',
 'Bucaramanga', 'keyword', true, 2),

('domicilios-bucaramanga',
 'Domicilios Bucaramanga — Salsas y Pulpas a tu Puerta',
 'Domicilios Bucaramanga — Salsas y Pulpas | SURTÉ YA',
 'Servicio de domicilios de salsas, pulpas y productos alimenticios en Bucaramanga. Pedidos por WhatsApp con entrega rápida en el área metropolitana.',
 'Domicilios en Bucaramanga — Tu Pedido a la Puerta',
 '<p>En <strong>SURTÉ YA</strong> llevamos tus salsas, pulpas y productos alimenticios hasta la puerta de tu negocio o casa en Bucaramanga y el área metropolitana.</p><h2>¿Cómo funciona?</h2><ol><li>Elige tus productos del catálogo</li><li>Agrega al carrito y confirma tu pedido</li><li>Recibe en la puerta de tu negocio o casa</li></ol><h2>Zonas de cobertura</h2><ul><li>Bucaramanga</li><li>Floridablanca</li><li>Girón</li><li>Piedecuesta</li></ul><p>Consulta el pedido mínimo y costo de domicilio según tu zona.</p>',
 'Bucaramanga', 'local', true, 3),

('domicilios-alimentos-bucaramanga',
 'Domicilios de Alimentos en Bucaramanga',
 'Domicilios de Alimentos Bucaramanga | SURTÉ YA — Pedidos por WhatsApp',
 'Pide alimentos a domicilio en Bucaramanga. Salsas, pulpas, cárnicos y más con envío rápido. Pedidos fáciles por WhatsApp.',
 'Domicilios de Alimentos a tu Puerta en Bucaramanga',
 '<p><strong>SURTÉ YA</strong> es tu aliado para surtir tu negocio o tu hogar con alimentos de calidad en Bucaramanga. Realizamos domicilios en toda el área metropolitana.</p><h2>Cobertura de Domicilios</h2><ul><li>Bucaramanga — todos los barrios</li><li>Floridablanca</li><li>Girón</li><li>Piedecuesta</li></ul><h2>¿Cómo pedir?</h2><ol><li>Agrega productos al carrito</li><li>Completa tus datos de entrega</li><li>Confirma por WhatsApp</li><li>¡Recibe en tu puerta!</li></ol>',
 'Bucaramanga', 'ciudad', true, 3),

('distribuidores-salsas-santander',
 'Distribuidores de Salsas en Santander',
 'Distribuidores de Salsas Santander | SURTÉ YA — La Unión',
 'Somos distribuidores oficiales de salsas La Unión en Santander. Precios mayoristas para HORECA, minimercados y distribuidores.',
 'Red de Distribución de Salsas La Unión en Santander',
 '<p>Como distribuidores oficiales de <strong>La Unión</strong> en Santander, ofrecemos la línea completa de salsas con precios especiales para el canal mayorista y distribuidores.</p><h2>Beneficios para Distribuidores</h2><ul><li>Precios escalonados por volumen</li><li>Lista de precios exclusiva para distribuidores</li><li>Soporte comercial dedicado</li><li>Entrega oportuna en todo Santander</li></ul><p>Contáctanos por WhatsApp para recibir nuestra lista de precios de distribuidor.</p>',
 'Bucaramanga', 'keyword', true, 4),

('proveedor-horeca-bucaramanga',
 'Proveedor HORECA en Bucaramanga — SURTÉ YA',
 'Proveedor HORECA Bucaramanga | SURTÉ YA — Salsas y Pulpas',
 'Proveedor mayorista para el sector HORECA en Bucaramanga. Salsas, pulpas y productos alimenticios con precios especiales para hoteles, restaurantes y catering.',
 'Tu Proveedor HORECA de Confianza en Bucaramanga',
 '<p><strong>SURTÉ YA</strong> es el proveedor ideal para el sector HORECA (Hoteles, Restaurantes, Catering) en Bucaramanga. Ofrecemos productos alimenticios de alta calidad con precios especiales para negocios.</p><h2>¿Qué ofrecemos al sector HORECA?</h2><ul><li>Salsas artesanales (piña, tártara, BBQ, rosada, ají)</li><li>Pulpas de fruta 100% naturales</li><li>Productos cárnicos seleccionados</li><li>Agua y bebidas al por mayor</li></ul><h2>Ventajas para tu Negocio</h2><ul><li>💰 Precios especiales por volumen</li><li>🚚 Entrega programada a tu establecimiento</li><li>📱 Pedidos fáciles por WhatsApp o app</li><li>📋 Facturación electrónica</li></ul>',
 'Bucaramanga', 'seo', true, 4),

('agua-al-por-mayor-bucaramanga',
 'Agua al por Mayor en Bucaramanga',
 'Agua al por Mayor Bucaramanga | SURTÉ YA — Envíos a Domicilio',
 'Distribución de agua al por mayor en Bucaramanga. Botellones, pacas y más con domicilio. Precios mayoristas para negocios.',
 'Agua Potable al por Mayor — Distribución en Bucaramanga',
 '<p>Distribuimos <strong>agua potable</strong> al por mayor en Bucaramanga y el área metropolitana. Ideal para oficinas, restaurantes, tiendas y hogares que necesitan abastecimiento constante.</p><h2>Presentaciones</h2><ul><li>Botellones</li><li>Pacas de botellas</li><li>Bolsas</li></ul><p>Entrega rápida a domicilio. Precios especiales por volumen.</p>',
 'Bucaramanga', 'keyword', true, 5),

('distribuidor-salsas-santander',
 'Distribuidor de Salsas en Santander — SURTÉ YA',
 'Distribuidor Salsas Santander | SURTÉ YA — La Unión',
 'Distribuidor autorizado de salsas La Unión en Santander. Salsas artesanales al por mayor para todo el departamento. Contacta por WhatsApp.',
 'Distribuidor de Salsas La Unión en Santander',
 '<p>Somos <strong>distribuidores autorizados</strong> de salsas <strong>La Unión</strong> para todo el departamento de Santander. Nuestro catálogo incluye las mejores salsas artesanales colombianas.</p><h2>Catálogo de Salsas La Unión</h2><ul><li>Salsa de Piña</li><li>Salsa Tártara</li><li>Salsa BBQ</li><li>Salsa Rosada</li><li>Salsa de Ají</li><li>Y más variedades</li></ul><h2>Cobertura en Santander</h2><p>Atendemos pedidos en Bucaramanga, Floridablanca, Girón, Piedecuesta, San Gil, Barrancabermeja y más municipios del departamento.</p><h2>Contacto</h2><p>Escríbenos por WhatsApp para solicitar tu cotización personalizada. Precios especiales para distribuidores y mayoristas.</p>',
 'Santander', 'seo', true, 5)

ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- SEED: App Settings (only missing keys)
-- =============================================
INSERT INTO app_settings (key, value) VALUES
('estimated_delivery_days', '1-2'),
('footer_nit', ''),
('product_default_image_url', ''),
('seo_facebook_catalog_id', ''),
('seo_facebook_pixel_id', ''),
('trust_badge_2_label', 'Pago Seguro'),
('trust_badge_2_sub', ''),
('trust_card_payment_sub', 'Contraentrega'),
('trust_card_payment_title', 'Pago Seguro'),
('trust_card_quality_sub', 'Garantizada'),
('trust_card_quality_title', 'Calidad'),
('trust_card_shipping_sub', '+{min_order}'),
('trust_card_shipping_title', 'Envío Gratis'),
('show_section_banners', 'true')
ON CONFLICT (key) DO NOTHING;
