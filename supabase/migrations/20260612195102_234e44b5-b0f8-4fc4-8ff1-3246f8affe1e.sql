-- 1) Catálogo global de módulos (UPSERT idempotente)
INSERT INTO public.modules (key, name, description, category, icon, is_active, sort_order) VALUES
  ('retail','Retail / Tienda','Catálogo, carrito y checkout para tienda online','core','store',true,10),
  ('horeca','HORECA','Mayoristas, distribución y precios por tipo de negocio','core','utensils',true,20),
  ('pos','POS / Caja','Punto de venta físico con turnos, pagos y arqueo','operations','monitor',true,30),
  ('kds','KDS Cocina','Pantalla de comandas para cocina','operations','chef-hat',true,40),
  ('mesas','Mesas','Gestión de mesas y comanderos','operations','grid-3x3',true,50),
  ('inventario','Inventario','Control de stock multi-bodega y movimientos','operations','package',true,60),
  ('agenda','Agenda / Citas','Reserva de citas con recursos (cabinas, profesionales, sillas)','verticals','calendar-days',true,70),
  ('spa','Spa & Bienestar','Servicios spa: tratamientos, terapias, fichas de cliente','verticals','flower',true,80),
  ('belleza','Belleza & Estética','Peluquería, uñas, depilación, estética avanzada','verticals','sparkles',true,90),
  ('representantes','Representantes','Portal y comisiones para fuerza de ventas externa','crm','briefcase',true,100),
  ('crm','CRM Leads','Captación y seguimiento de prospectos','crm','users',true,110),
  ('licencias','Licencias Desktop','Emisión y control de licencias del POS Desktop','admin','key-round',true,120),
  ('whatsapp','WhatsApp','Mensajería transaccional, recibos y notificaciones','operations','message-circle',true,130),
  ('fiscal','Facturación electrónica','Emisión y reportes DIAN (Colombia)','admin','file-text',true,140),
  ('compras','Compras / Proveedores','Órdenes de compra, recepciones y costos','operations','truck',true,150)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 2) Activación por defecto por organización (solo si la org existe en el entorno)
WITH defaults(slug, module_key) AS (VALUES
  ('surteya','retail'),('surteya','horeca'),('surteya','pos'),('surteya','kds'),
  ('surteya','mesas'),('surteya','inventario'),('surteya','agenda'),('surteya','crm'),('surteya','licencias'),
  ('demo','retail'),('demo','horeca'),('demo','pos'),('demo','kds'),('demo','mesas'),
  ('demo','inventario'),('demo','agenda'),('demo','crm'),('demo','licencias'),('demo','compras'),('demo','whatsapp'),
  ('dimanti','retail'),('dimanti','pos'),('dimanti','inventario'),('dimanti','agenda'),
  ('dimanti','spa'),('dimanti','belleza'),('dimanti','crm')
)
INSERT INTO public.organization_modules (organization_id, module_key, enabled, config)
SELECT o.id, d.module_key, true, '{}'::jsonb
FROM defaults d
JOIN public.organizations o ON o.slug = d.slug
ON CONFLICT (organization_id, module_key) DO NOTHING;