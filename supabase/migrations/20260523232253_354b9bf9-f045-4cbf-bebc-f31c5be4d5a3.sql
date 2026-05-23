-- =========================================================
-- FASE 1: Catálogo de módulos + tablas spa/belleza/agenda
-- =========================================================

-- 1) Catálogo central de módulos
CREATE TABLE IF NOT EXISTS public.modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modules readable by authenticated"
  ON public.modules FOR SELECT TO authenticated USING (true);

CREATE POLICY "modules managed by superadmin"
  ON public.modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed catálogo
INSERT INTO public.modules (key, name, description, category, icon, sort_order) VALUES
  ('retail',         'Retail / Tienda',     'Catálogo, carrito y checkout para tienda online', 'core',     'store',         10),
  ('horeca',         'HORECA',              'Mayoristas, distribución y precios por tipo de negocio', 'core', 'utensils',      20),
  ('pos',            'POS / Caja',          'Punto de venta físico con turnos, pagos y arqueo', 'operations', 'monitor',     30),
  ('kds',            'KDS Cocina',          'Pantalla de comandas para cocina', 'operations', 'chef-hat',  40),
  ('mesas',          'Mesas',               'Gestión de mesas y comanderos', 'operations', 'grid-3x3',  50),
  ('inventario',     'Inventario',          'Control de stock multi-bodega y movimientos', 'operations', 'package', 60),
  ('agenda',         'Agenda / Citas',      'Reserva de citas con recursos (cabinas, profesionales, sillas)', 'verticals', 'calendar-days', 70),
  ('spa',            'Spa & Bienestar',     'Servicios spa: tratamientos, terapias, fichas de cliente', 'verticals', 'flower', 80),
  ('belleza',        'Belleza & Estética',  'Peluquería, uñas, depilación, estética avanzada', 'verticals', 'sparkles', 90),
  ('representantes', 'Representantes',      'Portal y comisiones para fuerza de ventas externa', 'crm', 'briefcase', 100),
  ('crm',            'CRM Leads',           'Captación y seguimiento de prospectos', 'crm', 'users', 110),
  ('licencias',      'Licencias Desktop',   'Emisión y control de licencias del POS Desktop', 'admin', 'key-round', 120)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- FK suave entre organization_modules.module_key y modules.key (sin romper datos)
ALTER TABLE public.organization_modules
  DROP CONSTRAINT IF EXISTS organization_modules_module_key_fkey;
ALTER TABLE public.organization_modules
  ADD CONSTRAINT organization_modules_module_key_fkey
  FOREIGN KEY (module_key) REFERENCES public.modules(key) ON UPDATE CASCADE ON DELETE RESTRICT
  NOT VALID;

-- =========================================================
-- 2) Recursos asignables (cabinas, sillas, profesionales)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.service_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'professional',  -- professional | room | chair | equipment
  professional_user_id uuid,                   -- opcional: si el recurso es una persona con cuenta
  color text,                                  -- color del calendario
  capacity int NOT NULL DEFAULT 1,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb, -- {mon:[["09:00","18:00"]], ...}
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_resources_org ON public.service_resources(organization_id, is_active);
ALTER TABLE public.service_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources select by org members"
  ON public.service_resources FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "resources insert by org members"
  ON public.service_resources FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "resources update by org members"
  ON public.service_resources FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "resources delete by org members"
  ON public.service_resources FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));

CREATE TRIGGER trg_service_resources_updated_at
  BEFORE UPDATE ON public.service_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3) Catálogo de servicios (spa, belleza, agenda)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  slug text,
  description text,
  category text,                                -- 'spa' | 'belleza' | 'unas' | 'masajes' | 'otro'
  duration_minutes int NOT NULL DEFAULT 60,
  buffer_minutes int NOT NULL DEFAULT 0,        -- limpieza/preparación
  price numeric(12,2) NOT NULL DEFAULT 0,
  cost numeric(12,2) DEFAULT 0,
  image_url text,
  requires_resource_kind text DEFAULT 'professional',
  allowed_resource_ids uuid[] DEFAULT '{}',     -- si vacío, cualquier recurso del kind sirve
  tags text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_org ON public.service_catalog(organization_id, is_active);
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services select by org members"
  ON public.service_catalog FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "services insert by org members"
  ON public.service_catalog FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "services update by org members"
  ON public.service_catalog FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "services delete by org members"
  ON public.service_catalog FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));

CREATE TRIGGER trg_service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4) Citas (appointments)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  service_id uuid REFERENCES public.service_catalog(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.service_resources(id) ON DELETE SET NULL,
  customer_user_id uuid,                        -- si el cliente tiene cuenta
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',     -- scheduled|confirmed|in_progress|completed|cancelled|no_show
  channel text NOT NULL DEFAULT 'admin',        -- admin|web|whatsapp|phone|widget
  price numeric(12,2) DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON public.appointments(organization_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_resource_time ON public.appointments(resource_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(organization_id, status);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments select by org members"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "appointments insert by org members"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "appointments update by org members"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "appointments delete by org members"
  ON public.appointments FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5) Helper: disponibilidad simple (slots libres en un día)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_resource_availability(
  _org_id uuid, _resource_id uuid, _day date, _slot_minutes int DEFAULT 30
) RETURNS TABLE (slot_start timestamptz, slot_end timestamptz, is_free boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH bounds AS (
    SELECT (_day::timestamp + time '08:00') AT TIME ZONE 'America/Bogota' AS d_start,
           (_day::timestamp + time '20:00') AT TIME ZONE 'America/Bogota' AS d_end
  ),
  series AS (
    SELECT gs AS slot_start, gs + make_interval(mins => _slot_minutes) AS slot_end
    FROM bounds, generate_series(d_start, d_end - make_interval(mins => _slot_minutes), make_interval(mins => _slot_minutes)) gs
  ),
  busy AS (
    SELECT starts_at, ends_at FROM public.appointments
    WHERE organization_id = _org_id
      AND resource_id = _resource_id
      AND status NOT IN ('cancelled','no_show')
      AND starts_at < (SELECT d_end FROM bounds)
      AND ends_at > (SELECT d_start FROM bounds)
  )
  SELECT s.slot_start, s.slot_end,
         NOT EXISTS (SELECT 1 FROM busy b WHERE b.starts_at < s.slot_end AND b.ends_at > s.slot_start) AS is_free
  FROM series s
  WHERE public.is_member_of(_org_id);
$$;