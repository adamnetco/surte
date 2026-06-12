
-- Etapa 33: Extender organizations con campos de tenant autónomo
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS hero_title text,
  ADD COLUMN IF NOT EXISTS hero_subtitle text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'es-CO',
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text;

-- app_settings: key debe ser única POR ORGANIZACIÓN, no global.
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_unique;

-- Unicidad por org cuando hay tenant.
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_org_key_uidx
  ON public.app_settings (organization_id, key)
  WHERE organization_id IS NOT NULL;

-- Unicidad para defaults globales (organization_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_global_key_uidx
  ON public.app_settings (key)
  WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS app_settings_org_idx
  ON public.app_settings (organization_id);

-- RLS refuerzo: cada org ve/edita lo suyo; defaults globales son legibles por todos los autenticados.
DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_write" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;

CREATE POLICY "app_settings_read"
  ON public.app_settings
  FOR SELECT
  TO authenticated, anon
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = app_settings.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "app_settings_write_org_admin"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = app_settings.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner','admin')
    ))
    OR public.has_role(auth.uid(), 'superadmin')
  )
  WITH CHECK (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = app_settings.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner','admin')
    ))
    OR public.has_role(auth.uid(), 'superadmin')
  );

-- Asegurar GRANTs (no rompe si ya existen).
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
