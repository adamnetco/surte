
-- =====================================================================
-- Slice 2A+2B: Catálogo dinámico de tipos de documento DIAN
-- Reemplaza el enum corto `einvoice_doc_type` por una tabla extensible
-- =====================================================================

-- 1) Catálogo global de tipos de documento (semilla SistecPOS)
CREATE TABLE public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                       -- pos_electronico / factura_electronica / dee_cambio ...
  family TEXT NOT NULL,                            -- factura / equivalente / soporte / nota / interno
  dian_code TEXT,                                  -- código DIAN oficial (01, 02, 15...) NULL si no va a DIAN
  label TEXT NOT NULL,                             -- nombre display
  description TEXT,
  goes_to_dian BOOLEAN NOT NULL DEFAULT true,
  requires_resolution BOOLEAN NOT NULL DEFAULT true,
  requires_customer_id BOOLEAN NOT NULL DEFAULT false,
  applies_to_modules TEXT[] NOT NULL DEFAULT ARRAY['pos'],   -- pos / fx / ecommerce / admin
  default_for_business_types TEXT[] DEFAULT '{}',  -- minimercado / horeca / mayorista / casa_cambio
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.document_types TO authenticated, anon;
GRANT ALL ON public.document_types TO service_role;

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_types readable by everyone"
  ON public.document_types FOR SELECT
  USING (true);

CREATE POLICY "document_types managed by superadmin"
  ON public.document_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_document_types_active ON public.document_types(is_active, sort_order);

-- 2) Activación por organización (qué docs puede emitir cada tenant)
CREATE TABLE public.organization_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,       -- default global del tenant (admite override por punto de venta vía pos_behavior)
  resolution_id UUID,                              -- FK a einvoice_configs si requiere resolución (lazy ref)
  numbering_prefix TEXT,
  numbering_from BIGINT,
  numbering_to BIGINT,
  numbering_current BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, document_type_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_document_types TO authenticated;
GRANT ALL ON public.organization_document_types TO service_role;

ALTER TABLE public.organization_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_doc_types: members can read"
  ON public.organization_document_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_document_types.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "org_doc_types: admins can manage"
  ON public.organization_document_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_document_types.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_document_types.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE INDEX idx_org_doc_types_org ON public.organization_document_types(organization_id, is_enabled);

-- 3) Garantizar un solo default por organización
CREATE UNIQUE INDEX uniq_org_default_doc_type
  ON public.organization_document_types(organization_id)
  WHERE is_default = true;

-- 4) Trigger updated_at
CREATE TRIGGER trg_document_types_updated_at
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_org_document_types_updated_at
  BEFORE UPDATE ON public.organization_document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Seed del catálogo base SistecPOS
INSERT INTO public.document_types
  (code, family, dian_code, label, description, goes_to_dian, requires_resolution, requires_customer_id, applies_to_modules, default_for_business_types, sort_order)
VALUES
  ('pos_electronico',     'equivalente', '20', 'POS Electrónico',          'Documento equivalente POS para venta a consumidor final.', true,  true,  false, ARRAY['pos'],            ARRAY['minimercado','retail','horeca'], 10),
  ('factura_electronica', 'factura',     '01', 'Factura Electrónica',      'Factura de venta electrónica DIAN. Requiere identificación del adquirente.', true,  true,  true,  ARRAY['pos','ecommerce'], ARRAY['mayorista','b2b'], 20),
  ('nota_credito',        'nota',        '91', 'Nota Crédito',             'Nota crédito asociada a factura electrónica.', true, true, true, ARRAY['pos','admin'], '{}', 30),
  ('nota_debito',         'nota',        '92', 'Nota Débito',              'Nota débito asociada a factura electrónica.', true, true, true, ARRAY['pos','admin'], '{}', 40),
  ('doc_soporte',         'soporte',     '05', 'Documento Soporte',        'Documento soporte en adquisición a no obligados a facturar.', true, true, true, ARRAY['admin'], '{}', 50),
  ('remision',            'interno',     NULL, 'Remisión',                 'Documento interno de remisión / traslado. No va a DIAN.', false, false, false, ARRAY['pos','admin'], '{}', 60),
  ('cotizacion',          'interno',     NULL, 'Cotización',               'Cotización para cliente. No va a DIAN.', false, false, false, ARRAY['pos','admin'], '{}', 70),
  ('recibo_interno',      'interno',     NULL, 'Recibo interno (sin DIAN)','Recibo no fiscal — operación interna o exenta.', false, false, false, ARRAY['pos'], '{}', 80),
  ('dee_cambio',          'equivalente', '15', 'DEE - Operación de cambio','Documento Equivalente Electrónico para casas de cambio (Res. 000165/2023).', true, true, true, ARRAY['fx'], ARRAY['casa_cambio'], 90)
ON CONFLICT (code) DO NOTHING;

-- 6) Backfill: activar automáticamente los tipos default según business_type de cada org
INSERT INTO public.organization_document_types (organization_id, document_type_id, is_enabled, is_default)
SELECT
  o.id,
  dt.id,
  true,
  CASE
    WHEN dt.code = 'pos_electronico' AND COALESCE(o.business_type, 'minimercado') IN ('minimercado','retail','horeca') THEN true
    WHEN dt.code = 'factura_electronica' AND o.business_type IN ('mayorista','b2b') THEN true
    ELSE false
  END
FROM public.organizations o
CROSS JOIN public.document_types dt
WHERE dt.code IN ('pos_electronico','factura_electronica','remision','recibo_interno')
  AND (dt.applies_to_modules && ARRAY['pos','ecommerce','admin'])
ON CONFLICT (organization_id, document_type_id) DO NOTHING;
