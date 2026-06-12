-- Seed idempotente del catálogo de módulos.
-- Necesario para que el diálogo "Módulos" del Superadmin liste opciones
-- en Live (la tabla `modules` quedó vacía tras el publish).
INSERT INTO public.modules (key, name, description, category, sort_order, is_active) VALUES
  ('retail',         'Retail / Tienda',           'Catálogo, ventas y caja para tiendas minoristas.',                 'core',       10,  true),
  ('horeca',         'HORECA',                    'Restaurantes, bares y cafés: mesas, comandas, cocina.',            'core',       20,  true),
  ('pos',            'POS / Caja',                'Punto de venta para mostrador con impresión y pagos.',             'operations', 30,  true),
  ('kds',            'KDS Cocina',                'Pantalla de cocina con ruteo por estación.',                       'operations', 40,  true),
  ('mesas',          'Mesas',                     'Gestión de áreas, mesas y cuentas abiertas.',                      'operations', 50,  true),
  ('inventario',     'Inventario',                'Stock, bodegas, transferencias y movimientos.',                    'operations', 60,  true),
  ('agenda',         'Agenda / Citas',            'Reserva de citas y recursos.',                                     'verticals',  70,  true),
  ('spa',            'Spa & Bienestar',           'Servicios, paquetes y comisiones para spa.',                       'verticals',  80,  true),
  ('belleza',        'Belleza & Estética',        'Salones y centros de belleza.',                                    'verticals',  90,  true),
  ('representantes', 'Representantes',            'Fuerza de ventas en calle con catálogo offline.',                  'crm',        100, true),
  ('crm',            'CRM Leads',                 'Captura y seguimiento de prospectos.',                             'crm',        110, true),
  ('licencias',      'Licencias Desktop',         'Emisión y control de licencias del POS de escritorio.',            'admin',      120, true),
  ('whatsapp',       'WhatsApp',                  'Integración con WhatsApp Cloud API.',                              'operations', 130, true),
  ('fiscal',         'Facturación electrónica',   'DIAN: facturación electrónica y documentos soporte.',              'admin',      140, true),
  ('compras',        'Compras / Proveedores',     'Órdenes de compra y gestión de proveedores.',                      'operations', 150, true)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      is_active = true;