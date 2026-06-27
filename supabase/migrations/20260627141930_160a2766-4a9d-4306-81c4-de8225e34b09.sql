
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense','cogs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_nature AS ENUM ('debit','credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fiscal_period_status AS ENUM ('open','closed','locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_entry_status AS ENUM ('draft','posted','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.accounting_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  nature public.account_nature NOT NULL,
  parent_id UUID REFERENCES public.accounting_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX idx_acc_accounts_org ON public.accounting_accounts(organization_id);
CREATE INDEX idx_acc_accounts_type ON public.accounting_accounts(organization_id, type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_accounts TO authenticated;
GRANT ALL ON public.accounting_accounts TO service_role;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acc_accounts_select_members" ON public.accounting_accounts FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "acc_accounts_write_admins" ON public.accounting_accounts FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']));

CREATE TABLE public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.fiscal_period_status NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, start_date, end_date)
);
CREATE INDEX idx_fiscal_periods_org ON public.fiscal_periods(organization_id, start_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_periods TO authenticated;
GRANT ALL ON public.fiscal_periods TO service_role;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_periods_select_members" ON public.fiscal_periods FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "fiscal_periods_write_admins" ON public.fiscal_periods FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']));

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_period_id UUID REFERENCES public.fiscal_periods(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_number TEXT,
  reference_type TEXT,
  reference_id UUID,
  narration TEXT,
  status public.journal_entry_status NOT NULL DEFAULT 'posted',
  is_reversal BOOLEAN NOT NULL DEFAULT false,
  reversed_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  posted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_journal_entries_org_date ON public.journal_entries(organization_id, entry_date DESC);
CREATE INDEX idx_journal_entries_ref ON public.journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entries_period ON public.journal_entries(fiscal_period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "je_select_members" ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "je_insert_admins" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']));
CREATE POLICY "je_update_admins" ON public.journal_entries FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']));

CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  narration TEXT,
  line_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT line_one_side CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0)
  )
);
CREATE INDEX idx_jel_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account ON public.journal_entry_lines(account_id);
CREATE INDEX idx_jel_org ON public.journal_entry_lines(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entry_lines TO service_role;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jel_select_members" ON public.journal_entry_lines FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "jel_write_admins" ON public.journal_entry_lines FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','owner']));

CREATE TRIGGER trg_acc_accounts_updated BEFORE UPDATE ON public.accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fiscal_periods_updated BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_journal_entries_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.post_journal_entry(
  p_organization_id UUID,
  p_entry_date DATE,
  p_narration TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_lines JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry_id UUID;
  v_period_id UUID;
  v_total_debit NUMERIC(15,2) := 0;
  v_total_credit NUMERIC(15,2) := 0;
  v_line JSONB;
  v_line_idx INT := 0;
BEGIN
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least 2 lines';
  END IF;

  SELECT id INTO v_period_id FROM public.fiscal_periods
  WHERE organization_id = p_organization_id
    AND p_entry_date BETWEEN start_date AND end_date LIMIT 1;

  IF v_period_id IS NOT NULL THEN
    PERFORM 1 FROM public.fiscal_periods WHERE id = v_period_id AND status = 'open';
    IF NOT FOUND THEN RAISE EXCEPTION 'Fiscal period closed for date %', p_entry_date; END IF;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::NUMERIC, 0);
  END LOOP;

  IF ROUND(v_total_debit, 2) <> ROUND(v_total_credit, 2) THEN
    RAISE EXCEPTION 'Journal entry unbalanced: debits=% credits=%', v_total_debit, v_total_credit;
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, fiscal_period_id, entry_date, narration,
    reference_type, reference_id, status, posted_by
  ) VALUES (
    p_organization_id, v_period_id, p_entry_date, p_narration,
    p_reference_type, p_reference_id, 'posted', auth.uid()
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, organization_id, account_id,
      debit_amount, credit_amount, narration, line_order
    ) VALUES (
      v_entry_id, p_organization_id, (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit')::NUMERIC, 0),
      COALESCE((v_line->>'credit')::NUMERIC, 0),
      v_line->>'narration', v_line_idx
    );
    v_line_idx := v_line_idx + 1;
  END LOOP;
  RETURN v_entry_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(UUID, DATE, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.void_journal_entry(p_entry_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig RECORD;
  v_reversal_id UUID;
BEGIN
  SELECT * INTO v_orig FROM public.journal_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF v_orig.status = 'voided' THEN RAISE EXCEPTION 'Entry already voided'; END IF;

  INSERT INTO public.journal_entries (
    organization_id, fiscal_period_id, entry_date, narration,
    reference_type, reference_id, status, is_reversal, reversed_entry_id, posted_by
  ) VALUES (
    v_orig.organization_id, v_orig.fiscal_period_id, CURRENT_DATE,
    COALESCE(p_reason, 'Reversal of ' || v_orig.id::text),
    v_orig.reference_type, v_orig.reference_id, 'posted', true, v_orig.id, auth.uid()
  ) RETURNING id INTO v_reversal_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, organization_id, account_id,
    debit_amount, credit_amount, narration, line_order
  )
  SELECT v_reversal_id, organization_id, account_id,
         credit_amount, debit_amount, 'REV: ' || COALESCE(narration,''), line_order
  FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id;

  UPDATE public.journal_entries SET status='voided' WHERE id = p_entry_id;
  RETURN v_reversal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.void_journal_entry(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.accounting_accounts WHERE organization_id = p_organization_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.accounting_accounts (organization_id, code, name, type, nature, is_system) VALUES
    (p_organization_id, '1105', 'Caja General',                          'asset',     'debit',  true),
    (p_organization_id, '1110', 'Bancos',                                'asset',     'debit',  true),
    (p_organization_id, '1305', 'Clientes (Cuentas por Cobrar)',         'asset',     'debit',  true),
    (p_organization_id, '1355', 'Anticipo Impuestos (IVA Descontable)',  'asset',     'debit',  true),
    (p_organization_id, '1435', 'Inventario de Mercancías',              'asset',     'debit',  true),
    (p_organization_id, '2205', 'Proveedores Nacionales',                'liability', 'credit', true),
    (p_organization_id, '2335', 'Costos y Gastos por Pagar',             'liability', 'credit', true),
    (p_organization_id, '2408', 'IVA por Pagar',                         'liability', 'credit', true),
    (p_organization_id, '2436', 'Retención en la Fuente por Pagar',      'liability', 'credit', true),
    (p_organization_id, '3105', 'Capital Social',                        'equity',    'credit', true),
    (p_organization_id, '3605', 'Utilidad del Ejercicio',                'equity',    'credit', true),
    (p_organization_id, '3705', 'Utilidades Retenidas',                  'equity',    'credit', true),
    (p_organization_id, '4135', 'Ingresos Comercio al por Mayor y Menor','revenue',   'credit', true),
    (p_organization_id, '4175', 'Devoluciones en Ventas',                'revenue',   'debit',  true),
    (p_organization_id, '6135', 'Costo de Ventas',                       'cogs',      'debit',  true),
    (p_organization_id, '5105', 'Gastos de Personal',                    'expense',   'debit',  true),
    (p_organization_id, '5135', 'Servicios',                             'expense',   'debit',  true),
    (p_organization_id, '5140', 'Gastos Legales',                        'expense',   'debit',  true),
    (p_organization_id, '5195', 'Diversos (Otros Gastos)',               'expense',   'debit',  true),
    (p_organization_id, '5305', 'Gastos Financieros',                    'expense',   'debit',  true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.seed_chart_of_accounts(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_seed_coa_on_org_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_chart_of_accounts(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_org_seed_coa ON public.organizations;
CREATE TRIGGER trg_org_seed_coa AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_coa_on_org_insert();

-- Backfill: seed COA for existing organizations
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_chart_of_accounts(r.id);
  END LOOP;
END $$;
