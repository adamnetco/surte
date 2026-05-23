
-- =====================================================
-- FASE 2: MESAS + KDS
-- =====================================================

-- 1) DINING AREAS
CREATE TABLE public.dining_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#0C4B83',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dining_areas_location ON public.dining_areas(location_id) WHERE is_active = true;

ALTER TABLE public.dining_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read areas" ON public.dining_areas FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage areas" ON public.dining_areas FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 2) DINING TABLES
CREATE TABLE public.dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  dining_area_id uuid REFERENCES public.dining_areas(id) ON DELETE SET NULL,
  label text NOT NULL,
  capacity integer NOT NULL DEFAULT 4,
  shape text NOT NULL DEFAULT 'square', -- square, round, rect
  pos_x numeric(8,2) NOT NULL DEFAULT 0,
  pos_y numeric(8,2) NOT NULL DEFAULT 0,
  width numeric(8,2) NOT NULL DEFAULT 80,
  height numeric(8,2) NOT NULL DEFAULT 80,
  status text NOT NULL DEFAULT 'available', -- available, occupied, reserved, dirty
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tables_area ON public.dining_tables(dining_area_id, status);
CREATE INDEX idx_tables_location ON public.dining_tables(location_id);

ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read tables" ON public.dining_tables FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage tables" ON public.dining_tables FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 3) SERVICE TYPES
CREATE TABLE public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  key text NOT NULL, -- dine_in, takeaway, delivery, bar
  label text NOT NULL,
  icon text DEFAULT 'Utensils',
  requires_table boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, key)
);
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read service types" ON public.service_types FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage service types" ON public.service_types FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 4) KITCHEN STATIONS
CREATE TABLE public.kitchen_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#F37021',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read stations" ON public.kitchen_stations FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage stations" ON public.kitchen_stations FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 5) TABLE ORDERS (comandas)
CREATE SEQUENCE IF NOT EXISTS public.table_order_seq START 1;

CREATE TABLE public.table_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  dining_table_id uuid REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  service_type_key text NOT NULL DEFAULT 'dine_in',
  order_number integer NOT NULL DEFAULT nextval('public.table_order_seq'),
  waiter_id uuid,
  guest_count integer NOT NULL DEFAULT 1,
  customer_name text,
  customer_phone text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tip numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open, sent, billed, paid, cancelled
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  billed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  pos_order_id uuid, -- al cobrar genera pos_order
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_table_orders_table ON public.table_orders(dining_table_id, status);
CREATE INDEX idx_table_orders_org_status ON public.table_orders(organization_id, status, opened_at DESC);

ALTER TABLE public.table_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read table orders" ON public.table_orders FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage table orders" ON public.table_orders FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 6) TABLE ORDER ITEMS
CREATE TABLE public.table_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  table_order_id uuid NOT NULL REFERENCES public.table_orders(id) ON DELETE CASCADE,
  product_id uuid,
  presentation_id uuid,
  kitchen_station_id uuid REFERENCES public.kitchen_stations(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  sku text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  course integer NOT NULL DEFAULT 1, -- tiempo (entrada, plato fuerte, postre)
  status text NOT NULL DEFAULT 'pending', -- pending, sent, ready, served, cancelled
  sent_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_table_items_order ON public.table_order_items(table_order_id);
CREATE INDEX idx_table_items_station ON public.table_order_items(kitchen_station_id, status);

ALTER TABLE public.table_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read table items" ON public.table_order_items FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage table items" ON public.table_order_items FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 7) KDS TICKETS (agrupa items enviados a una estación)
CREATE TABLE public.kds_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  kitchen_station_id uuid REFERENCES public.kitchen_stations(id) ON DELETE SET NULL,
  table_order_id uuid REFERENCES public.table_orders(id) ON DELETE CASCADE,
  dining_table_label text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending, in_progress, ready, served
  priority integer NOT NULL DEFAULT 0,
  notes text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  bumped_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kds_station_status ON public.kds_tickets(kitchen_station_id, status, sent_at);
CREATE INDEX idx_kds_org_status ON public.kds_tickets(organization_id, status, sent_at);

ALTER TABLE public.kds_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read kds" ON public.kds_tickets FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage kds" ON public.kds_tickets FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 8) updated_at triggers
CREATE TRIGGER trg_dining_areas_updated BEFORE UPDATE ON public.dining_areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dining_tables_updated BEFORE UPDATE ON public.dining_tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_table_orders_updated BEFORE UPDATE ON public.table_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kds_tickets_updated BEFORE UPDATE ON public.kds_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) REALTIME
ALTER TABLE public.table_orders REPLICA IDENTITY FULL;
ALTER TABLE public.table_order_items REPLICA IDENTITY FULL;
ALTER TABLE public.kds_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.dining_tables REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kds_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_tables;

-- 10) Seed: módulos + datos demo para SurteYa
INSERT INTO public.organization_modules (organization_id, module_key, enabled)
SELECT id, m, true FROM public.organizations,
LATERAL (VALUES ('tables'), ('kds')) AS x(m)
WHERE slug = 'surteya'
ON CONFLICT DO NOTHING;

-- Service types
INSERT INTO public.service_types (organization_id, key, label, icon, requires_table, sort_order)
SELECT o.id, x.k, x.lbl, x.icn, x.req, x.so
FROM public.organizations o,
LATERAL (VALUES
  ('dine_in',  'Mesa',       'Utensils',  true,  0),
  ('takeaway', 'Para llevar','ShoppingBag',false, 1),
  ('delivery', 'Domicilio',  'Bike',      false, 2),
  ('bar',      'Barra',      'GlassWater',false, 3)
) AS x(k, lbl, icn, req, so)
WHERE o.slug = 'surteya'
ON CONFLICT DO NOTHING;

-- Kitchen stations
INSERT INTO public.kitchen_stations (organization_id, location_id, name, color, sort_order)
SELECT l.organization_id, l.id, x.n, x.c, x.so
FROM public.locations l
JOIN public.organizations o ON o.id = l.organization_id
CROSS JOIN LATERAL (VALUES
  ('Cocina caliente', '#F37021', 0),
  ('Cocina fría',     '#76B833', 1),
  ('Barra',           '#0C4B83', 2)
) AS x(n, c, so)
WHERE o.slug = 'surteya' AND l.is_main = true;

-- Dining area + 8 mesas demo
WITH org AS (SELECT id FROM public.organizations WHERE slug = 'surteya' LIMIT 1),
loc AS (SELECT id, organization_id FROM public.locations WHERE is_main = true AND organization_id = (SELECT id FROM org) LIMIT 1),
area AS (
  INSERT INTO public.dining_areas (organization_id, location_id, name, sort_order)
  SELECT organization_id, id, 'Salón Principal', 0 FROM loc
  RETURNING id, organization_id, location_id
)
INSERT INTO public.dining_tables (organization_id, location_id, dining_area_id, label, capacity, pos_x, pos_y)
SELECT a.organization_id, a.location_id, a.id, 'M' || g, 4,
       100 + ((g-1) % 4) * 120, 100 + ((g-1) / 4) * 120
FROM area a, generate_series(1, 8) g;
