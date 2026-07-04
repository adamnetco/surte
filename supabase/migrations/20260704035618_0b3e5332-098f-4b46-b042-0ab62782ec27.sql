ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tip_default_pct numeric(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tip_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.tip_default_pct IS 'Porcentaje de propina sugerida en la pre-cuenta (restaurantes). Default 10%.';
COMMENT ON COLUMN public.organizations.tip_enabled IS 'Si false, no se sugiere propina en la pre-cuenta.';