ALTER TABLE public.einvoice_configs
  ADD COLUMN IF NOT EXISTS hard_block_when_dian_down BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.einvoice_configs.hard_block_when_dian_down IS
  'Si true, el POS bloquea el botón Cobrar cuando DIAN/Innapsis está offline y no hay rango de contingencia vigente. Opt-in por organización.';