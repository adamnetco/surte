-- Loyalty programs configuration
CREATE TABLE public.loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'points' CHECK (mode IN ('points','cashback')),
  accrual_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0, -- points per 1000 COP (or cashback %)
  redemption_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0, -- COP per 1 point
  min_redemption INTEGER NOT NULL DEFAULT 100,
  expiration_days INTEGER, -- NULL = no expira
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_programs_member_read" ON public.loyalty_programs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_programs.organization_id AND om.user_id = auth.uid()));

CREATE POLICY "loyalty_programs_admin_write" ON public.loyalty_programs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_programs.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_programs.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));

-- Loyalty accounts (one per customer per org)
CREATE TABLE public.loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_earned NUMERIC(14,2) NOT NULL DEFAULT 0,
  points_redeemed NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_accounts_member_all" ON public.loyalty_accounts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_accounts.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_accounts.organization_id AND om.user_id = auth.uid()));

CREATE INDEX idx_loyalty_accounts_org_profile ON public.loyalty_accounts(organization_id, profile_id);

-- Loyalty movements (audit + history)
CREATE TABLE public.loyalty_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('earn','redeem','expire','adjust')),
  points NUMERIC(14,2) NOT NULL,
  order_id UUID,
  notes TEXT,
  created_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_movements TO authenticated;
GRANT ALL ON public.loyalty_movements TO service_role;
ALTER TABLE public.loyalty_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_movements_member_all" ON public.loyalty_movements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_movements.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = loyalty_movements.organization_id AND om.user_id = auth.uid()));

CREATE INDEX idx_loyalty_movements_org_profile ON public.loyalty_movements(organization_id, profile_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loyalty_accounts_updated_at BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Accrual function
CREATE OR REPLACE FUNCTION public.loyalty_accrue(
  p_organization_id UUID,
  p_profile_id UUID,
  p_order_id UUID,
  p_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program RECORD;
  v_account_id UUID;
  v_points NUMERIC;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_program FROM public.loyalty_programs
    WHERE organization_id = p_organization_id AND is_active = true;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Calcular puntos: tasa por cada 1000 COP (o % cashback)
  IF v_program.mode = 'points' THEN
    v_points := ROUND((p_amount / 1000.0) * v_program.accrual_rate, 2);
  ELSE
    v_points := ROUND(p_amount * (v_program.accrual_rate / 100.0), 2);
  END IF;

  IF v_points <= 0 THEN RETURN 0; END IF;

  -- Upsert cuenta
  INSERT INTO public.loyalty_accounts (organization_id, profile_id, points_earned, balance, last_activity_at)
    VALUES (p_organization_id, p_profile_id, v_points, v_points, now())
  ON CONFLICT (organization_id, profile_id) DO UPDATE
    SET points_earned = loyalty_accounts.points_earned + v_points,
        balance = loyalty_accounts.balance + v_points,
        last_activity_at = now()
  RETURNING id INTO v_account_id;

  IF v_program.expiration_days IS NOT NULL THEN
    v_expires_at := now() + (v_program.expiration_days || ' days')::interval;
  END IF;

  INSERT INTO public.loyalty_movements (organization_id, account_id, profile_id, movement_type, points, order_id, expires_at, created_by)
    VALUES (p_organization_id, v_account_id, p_profile_id, 'earn', v_points, p_order_id, v_expires_at, auth.uid());

  RETURN v_points;
END;
$$;

-- Redemption function
CREATE OR REPLACE FUNCTION public.loyalty_redeem(
  p_organization_id UUID,
  p_profile_id UUID,
  p_points NUMERIC,
  p_order_id UUID DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program RECORD;
  v_account RECORD;
  v_discount NUMERIC;
BEGIN
  SELECT * INTO v_program FROM public.loyalty_programs
    WHERE organization_id = p_organization_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programa de fidelización no activo'; END IF;

  IF p_points < v_program.min_redemption THEN
    RAISE EXCEPTION 'Mínimo de redención: % puntos', v_program.min_redemption;
  END IF;

  SELECT * INTO v_account FROM public.loyalty_accounts
    WHERE organization_id = p_organization_id AND profile_id = p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_account.balance < p_points THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE public.loyalty_accounts
    SET points_redeemed = points_redeemed + p_points,
        balance = balance - p_points,
        last_activity_at = now()
    WHERE id = v_account.id;

  INSERT INTO public.loyalty_movements (organization_id, account_id, profile_id, movement_type, points, order_id, created_by)
    VALUES (p_organization_id, v_account.id, p_profile_id, 'redeem', -p_points, p_order_id, auth.uid());

  v_discount := ROUND(p_points * v_program.redemption_rate, 2);
  RETURN v_discount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.loyalty_accrue(UUID,UUID,UUID,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_redeem(UUID,UUID,NUMERIC,UUID) TO authenticated;