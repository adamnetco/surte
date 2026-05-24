
-- Tabla configurable de acceso por sección admin
CREATE TABLE IF NOT EXISTS public.admin_section_access (
  section_key text PRIMARY KEY,
  label text NOT NULL,
  allowed_roles public.app_role[] NOT NULL DEFAULT ARRAY['superadmin','admin']::public.app_role[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.admin_section_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "section_access_read_auth" ON public.admin_section_access;
CREATE POLICY "section_access_read_auth"
  ON public.admin_section_access FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "section_access_write_superadmin" ON public.admin_section_access;
CREATE POLICY "section_access_write_superadmin"
  ON public.admin_section_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

-- Seed de secciones gestionables
INSERT INTO public.admin_section_access (section_key, label, allowed_roles) VALUES
  ('admin',      'Acceso general al panel /admin', ARRAY['superadmin','admin']::public.app_role[]),
  ('productos',  'Gestión de productos',            ARRAY['superadmin','admin','editor']::public.app_role[]),
  ('pedidos',    'Gestión de pedidos',              ARRAY['superadmin','admin','agente']::public.app_role[]),
  ('inventario', 'Gestión de inventario',           ARRAY['superadmin','admin']::public.app_role[])
ON CONFLICT (section_key) DO NOTHING;

-- Función: puede el usuario actual acceder a una sección?
CREATE OR REPLACE FUNCTION public.can_access_section(_section text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_section_access s
      WHERE s.section_key = _section
        AND public.get_current_user_role() = ANY(s.allowed_roles)
    );
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_admin_section_access()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_admin_section_access ON public.admin_section_access;
CREATE TRIGGER trg_touch_admin_section_access
  BEFORE UPDATE ON public.admin_section_access
  FOR EACH ROW EXECUTE FUNCTION public.touch_admin_section_access();
