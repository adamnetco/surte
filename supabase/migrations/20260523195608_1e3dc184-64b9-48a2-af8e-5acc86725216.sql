-- ============================================
-- FASE 4: Facturación electrónica Innapsis/DIAN
-- ============================================

-- 1) Config por organización
CREATE TABLE public.einvoice_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'dev' CHECK (environment IN ('dev','prod')),
  nit text NOT NULL,
  dv text,
  razon_social text,
  api_key text NOT NULL,
  resolution_number text,
  resolution_prefix text,
  resolution_from bigint,
  resolution_to bigint,
  resolution_current bigint,
  resolution_valid_from date,
  resolution_valid_until date,
  technical_key text,
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean NOT NULL DEFAULT false,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, environment)
);

ALTER TABLE public.einvoice_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "einvoice_configs_select"
  ON public.einvoice_configs FOR SELECT
  USING (public.is_member_of(organization_id));

CREATE POLICY "einvoice_configs_write"
  ON public.einvoice_configs FOR ALL
  USING (public.is_member_of(organization_id) AND public.org_role(organization_id) IN ('owner','admin','manager'))
  WITH CHECK (public.is_member_of(organization_id) AND public.org_role(organization_id) IN ('owner','admin','manager'));

CREATE TRIGGER trg_einvoice_configs_updated
  BEFORE UPDATE ON public.einvoice_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Documentos electrónicos emitidos
CREATE TABLE public.electronic_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice','credit_note','debit_note','support_document','payroll')),
  pos_order_id uuid REFERENCES public.pos_orders(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  prefix text,
  number bigint,
  full_number text,
  issue_date timestamptz NOT NULL DEFAULT now(),
  customer_identification text,
  customer_name text,
  customer_email text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'COP',
  track_id text,
  cufe text,
  qr_url text,
  xml_url text,
  pdf_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','accepted','rejected','void','error')),
  dian_response jsonb,
  request_payload jsonb,
  last_error text,
  environment text NOT NULL DEFAULT 'dev',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_einvoice_org_status ON public.electronic_invoices(organization_id, status);
CREATE INDEX idx_einvoice_pos_order ON public.electronic_invoices(pos_order_id);
CREATE INDEX idx_einvoice_track ON public.electronic_invoices(track_id);

ALTER TABLE public.electronic_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "electronic_invoices_select"
  ON public.electronic_invoices FOR SELECT
  USING (public.is_member_of(organization_id));

CREATE POLICY "electronic_invoices_insert"
  ON public.electronic_invoices FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "electronic_invoices_update"
  ON public.electronic_invoices FOR UPDATE
  USING (public.is_member_of(organization_id) AND public.org_role(organization_id) IN ('owner','admin','manager','cashier'));

CREATE TRIGGER trg_einvoice_updated
  BEFORE UPDATE ON public.electronic_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Bitácora de eventos
CREATE TABLE public.einvoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.electronic_invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  message text,
  payload jsonb,
  response jsonb,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_einvoice_events_invoice ON public.einvoice_events(invoice_id);
CREATE INDEX idx_einvoice_events_org ON public.einvoice_events(organization_id, created_at DESC);

ALTER TABLE public.einvoice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "einvoice_events_select"
  ON public.einvoice_events FOR SELECT
  USING (public.is_member_of(organization_id));

CREATE POLICY "einvoice_events_insert"
  ON public.einvoice_events FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

-- 4) Activa módulo (deshabilitado por defecto, cada org lo activa cuando contrata Innapsis)
INSERT INTO public.organization_modules (organization_id, module_key, enabled, config)
SELECT id, 'einvoice_innapsis', false, '{}'::jsonb
FROM public.organizations
ON CONFLICT (organization_id, module_key) DO NOTHING;

-- 5) Realtime para estado DIAN asíncrono
ALTER TABLE public.electronic_invoices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.electronic_invoices;