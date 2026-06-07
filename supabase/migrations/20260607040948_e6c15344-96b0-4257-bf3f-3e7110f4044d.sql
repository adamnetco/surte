-- Tabla de feature flags para el refactor por etapas (ver .lovable/plan.md).
-- Permite activar/desactivar refactors globalmente o por tenant sin redeploy.

CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  tenant_ids uuid[] NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PostgREST grants. Lectura para authenticated y anon (las flags son
-- públicas a nivel de bandera; nunca contienen secretos). Escritura
-- sólo vía service_role / superadmin con policy explícita abajo.
GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede LEER las flags (necesario para el frontend antes de
-- autenticarse, p.ej. en storefront público).
CREATE POLICY "feature_flags_read_all"
  ON public.feature_flags
  FOR SELECT
  USING (true);

-- Sólo superadmin puede modificar.
CREATE POLICY "feature_flags_write_superadmin"
  ON public.feature_flags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Trigger updated_at (reutiliza función existente si la hay).
CREATE OR REPLACE FUNCTION public.tg_feature_flags_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feature_flags_touch
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.tg_feature_flags_touch();

-- Semilla con las flags previstas en el plan (todas apagadas).
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('refactor.modules-layout',     false, 'Etapa 1 — mover a src/modules/<dominio>'),
  ('refactor.tanstack-query',     false, 'Etapa 2 — capa de datos con TanStack Query'),
  ('refactor.zustand-stores',     false, 'Etapa 3 — Zustand para cart/agent/swipe'),
  ('refactor.zod-everywhere',     false, 'Etapa 4 — Zod en cliente y edge functions'),
  ('refactor.design-tokens-lint', false, 'Etapa 5 — lint contra colores literales'),
  ('refactor.bundle-splitting',   false, 'Etapa 6 — code splitting por módulo')
ON CONFLICT (key) DO NOTHING;