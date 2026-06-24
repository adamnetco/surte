ALTER TABLE public.einvoice_configs
  ADD COLUMN IF NOT EXISTS default_doc_type_consumer_final TEXT NOT NULL DEFAULT 'pos_electronico',
  ADD COLUMN IF NOT EXISTS default_doc_type_with_nit       TEXT NOT NULL DEFAULT 'factura_electronica',
  ADD COLUMN IF NOT EXISTS default_doc_type_fx_operation   TEXT NOT NULL DEFAULT 'documento_soporte';

COMMENT ON COLUMN public.einvoice_configs.default_doc_type_consumer_final IS
  'Tipo de documento DIAN que el POS sugiere cuando el cliente NO tiene NIT/CC (consumidor final).';
COMMENT ON COLUMN public.einvoice_configs.default_doc_type_with_nit IS
  'Tipo de documento DIAN que el POS sugiere cuando el cliente tiene NIT/CC.';
COMMENT ON COLUMN public.einvoice_configs.default_doc_type_fx_operation IS
  'Tipo de documento DIAN que el módulo FX (Casa de Cambio) usa siempre.';

-- Backfill basado en organizations.business_type, solo en filas que aún tengan los defaults estándar
-- (no pisar customizaciones que un admin haya hecho manualmente vía UI).
UPDATE public.einvoice_configs c
SET default_doc_type_consumer_final = CASE o.business_type
      WHEN 'casa_de_cambio' THEN 'documento_soporte'
      WHEN 'b2b'            THEN 'factura_electronica'
      WHEN 'mayorista'      THEN 'factura_electronica'
      ELSE 'pos_electronico'
    END,
    default_doc_type_with_nit = CASE o.business_type
      WHEN 'casa_de_cambio' THEN 'documento_soporte'
      ELSE 'factura_electronica'
    END,
    default_doc_type_fx_operation = 'documento_soporte'
FROM public.organizations o
WHERE c.organization_id = o.id
  AND c.default_doc_type_consumer_final = 'pos_electronico'
  AND c.default_doc_type_with_nit       = 'factura_electronica'
  AND c.default_doc_type_fx_operation   = 'documento_soporte';