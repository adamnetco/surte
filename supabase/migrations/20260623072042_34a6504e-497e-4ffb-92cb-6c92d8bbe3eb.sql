-- 1) Agregar casa_cambio al enum business_type
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'casa_cambio';

-- 2) Agregar columnas de configuración UIAF en organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS uiaf_threshold_amount NUMERIC(18,2) DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS uiaf_threshold_currency TEXT DEFAULT 'USD';

-- 3) fx_currencies
CREATE TABLE public.fx_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT,
  decimals SMALLINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);
CREATE INDEX idx_fx_currencies_org ON public.fx_currencies(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_currencies TO authenticated;
GRANT ALL ON public.fx_currencies TO service_role;

ALTER TABLE public.fx_currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_currencies_select_members" ON public.fx_currencies FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_currencies_insert_members" ON public.fx_currencies FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_currencies_update_members" ON public.fx_currencies FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_currencies_delete_admins" ON public.fx_currencies FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner','admin')
  ));

-- 4) fx_pairs
CREATE TABLE public.fx_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_currency_id UUID NOT NULL REFERENCES public.fx_currencies(id) ON DELETE RESTRICT,
  quote_currency_id UUID NOT NULL REFERENCES public.fx_currencies(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, base_currency_id, quote_currency_id),
  CHECK (base_currency_id <> quote_currency_id)
);
CREATE INDEX idx_fx_pairs_org ON public.fx_pairs(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_pairs TO authenticated;
GRANT ALL ON public.fx_pairs TO service_role;

ALTER TABLE public.fx_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_pairs_select_members" ON public.fx_pairs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_pairs_insert_members" ON public.fx_pairs FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_pairs_update_members" ON public.fx_pairs FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_pairs_delete_admins" ON public.fx_pairs FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner','admin')
  ));

-- 5) fx_rates
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.fx_pairs(id) ON DELETE CASCADE,
  buy_rate NUMERIC(18,6) NOT NULL CHECK (buy_rate > 0),
  sell_rate NUMERIC(18,6) NOT NULL CHECK (sell_rate > 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','trm_banrep','api')),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fx_rates_org_pair_eff ON public.fx_rates(organization_id, pair_id, effective_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_rates_select_members" ON public.fx_rates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_rates_insert_members" ON public.fx_rates FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_rates_update_admins" ON public.fx_rates FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner','admin')
  ));
CREATE POLICY "fx_rates_delete_admins" ON public.fx_rates FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner','admin')
  ));

-- 6) fx_transactions
CREATE TABLE public.fx_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id),
  cash_session_id UUID REFERENCES public.cash_sessions(id),
  pair_id UUID NOT NULL REFERENCES public.fx_pairs(id),
  operation TEXT NOT NULL CHECK (operation IN ('buy','sell')),
  from_currency_id UUID NOT NULL REFERENCES public.fx_currencies(id),
  to_currency_id UUID NOT NULL REFERENCES public.fx_currencies(id),
  from_amount NUMERIC(18,2) NOT NULL CHECK (from_amount > 0),
  to_amount NUMERIC(18,2) NOT NULL CHECK (to_amount > 0),
  rate_applied NUMERIC(18,6) NOT NULL CHECK (rate_applied > 0),
  customer_doc_type TEXT,
  customer_doc_number TEXT,
  customer_name TEXT,
  customer_address TEXT,
  customer_occupation TEXT,
  funds_origin TEXT,
  is_above_threshold BOOLEAN NOT NULL DEFAULT false,
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  ros_reason TEXT,
  cashier_id UUID REFERENCES auth.users(id),
  receipt_number TEXT,
  electronic_invoice_id UUID REFERENCES public.electronic_invoices(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fx_tx_org_created ON public.fx_transactions(organization_id, created_at DESC);
CREATE INDEX idx_fx_tx_cashier ON public.fx_transactions(cashier_id);
CREATE INDEX idx_fx_tx_session ON public.fx_transactions(cash_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_transactions TO authenticated;
GRANT ALL ON public.fx_transactions TO service_role;

ALTER TABLE public.fx_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_tx_select_members" ON public.fx_transactions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_tx_insert_members" ON public.fx_transactions FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_tx_update_admins" ON public.fx_transactions FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner','admin')
  ));
CREATE POLICY "fx_tx_delete_admins" ON public.fx_transactions FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner','admin')
  ));

-- 7) fx_audit_log (inmutable)
CREATE TABLE public.fx_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.fx_transactions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fx_audit_org_created ON public.fx_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_fx_audit_tx ON public.fx_audit_log(transaction_id);

GRANT SELECT, INSERT ON public.fx_audit_log TO authenticated;
GRANT ALL ON public.fx_audit_log TO service_role;

ALTER TABLE public.fx_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log: SELECT permitido a miembros, INSERT solo desde triggers/service_role
-- UPDATE y DELETE: NUNCA permitidos (inmutable)
CREATE POLICY "fx_audit_select_members" ON public.fx_audit_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
CREATE POLICY "fx_audit_insert_service" ON public.fx_audit_log FOR INSERT
  WITH CHECK (true);
-- Sin políticas UPDATE/DELETE = imposible modificar

-- 8) Trigger updated_at compartido
CREATE OR REPLACE FUNCTION public.fx_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_fx_currencies_updated BEFORE UPDATE ON public.fx_currencies
  FOR EACH ROW EXECUTE FUNCTION public.fx_set_updated_at();
CREATE TRIGGER trg_fx_pairs_updated BEFORE UPDATE ON public.fx_pairs
  FOR EACH ROW EXECUTE FUNCTION public.fx_set_updated_at();

-- 9) Trigger de auditoría automática en fx_transactions
CREATE OR REPLACE FUNCTION public.fx_log_transaction() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.fx_audit_log (organization_id, transaction_id, event_type, payload, actor_id)
  VALUES (
    NEW.organization_id,
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'fx.transaction.created' ELSE 'fx.transaction.updated' END,
    jsonb_build_object(
      'operation', NEW.operation,
      'from_amount', NEW.from_amount,
      'to_amount', NEW.to_amount,
      'rate_applied', NEW.rate_applied,
      'is_above_threshold', NEW.is_above_threshold,
      'is_suspicious', NEW.is_suspicious
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_fx_tx_audit AFTER INSERT OR UPDATE ON public.fx_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fx_log_transaction();

-- 10) Activar módulo casas-de-cambio para organizaciones existentes tipo casa_cambio
-- (Si no hay ninguna aún, este insert no hace nada)
INSERT INTO public.organization_modules (organization_id, module_key, enabled, config)
SELECT id, 'casas-de-cambio', true, '{}'::jsonb
FROM public.organizations
WHERE business_type::text = 'casa_cambio'
ON CONFLICT DO NOTHING;