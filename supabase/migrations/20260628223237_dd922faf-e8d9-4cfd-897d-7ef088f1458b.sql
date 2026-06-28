
-- 1) Ledger
CREATE TABLE IF NOT EXISTS public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversion_id uuid REFERENCES public.referral_conversions(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  currency text NOT NULL DEFAULT 'COP',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','consumed','expired')),
  reason text NOT NULL DEFAULT 'referral_reward',
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_invoice_id uuid REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_credits_org_status_idx
  ON public.referral_credits(organization_id, status);

GRANT SELECT ON public.referral_credits TO authenticated;
GRANT ALL ON public.referral_credits TO service_role;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read own org credits"
  ON public.referral_credits FOR SELECT
  TO authenticated
  USING (
    public.is_member_of(organization_id)
    AND public.org_role(organization_id) IN ('owner','admin')
  );

CREATE POLICY "Service role manages credits"
  ON public.referral_credits FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_referral_credits_updated_at
  BEFORE UPDATE ON public.referral_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Qualification function
CREATE OR REPLACE FUNCTION public.process_referral_qualification(
  p_referee_org_id uuid,
  p_paid_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.referral_conversions%ROWTYPE;
  v_cfg  public.referral_rewards_config%ROWTYPE;
  v_credit_id uuid;
  v_expires timestamptz;
BEGIN
  -- Find a pending conversion for this referee
  SELECT * INTO v_conv
  FROM public.referral_conversions
  WHERE referee_org_id = p_referee_org_id
    AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_conversion');
  END IF;

  -- Load active config (global)
  SELECT * INTO v_cfg
  FROM public.referral_rewards_config
  WHERE is_active = true AND plan_code IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_config');
  END IF;

  -- Check qualifying window
  IF v_conv.created_at + (v_cfg.qualifying_period_days || ' days')::interval < now() THEN
    UPDATE public.referral_conversions
      SET status = 'expired', updated_at = now(),
          notes = COALESCE(notes,'') || ' [auto-expired at payment]'
      WHERE id = v_conv.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'window_expired');
  END IF;

  -- Mark conversion qualified + rewarded
  UPDATE public.referral_conversions
     SET status = 'rewarded',
         qualified_at = COALESCE(qualified_at, now()),
         rewarded_at = now(),
         reward_amount = v_cfg.referrer_reward_amount,
         reward_currency = v_cfg.referrer_reward_currency,
         updated_at = now()
   WHERE id = v_conv.id;

  v_expires := now() + interval '180 days';

  -- Issue credit to referrer
  INSERT INTO public.referral_credits(
    organization_id, conversion_id, amount, currency, status,
    reason, expires_at, metadata
  ) VALUES (
    v_conv.referrer_org_id, v_conv.id,
    v_cfg.referrer_reward_amount, v_cfg.referrer_reward_currency,
    'available', 'referral_reward', v_expires,
    jsonb_build_object('referee_org_id', p_referee_org_id, 'paid_amount', p_paid_amount)
  ) RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'conversion_id', v_conv.id,
    'credit_id', v_credit_id,
    'amount', v_cfg.referrer_reward_amount,
    'currency', v_cfg.referrer_reward_currency,
    'expires_at', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_referral_qualification(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_referral_qualification(uuid, numeric) TO service_role;

-- 3) Trigger on subscription_invoices
CREATE OR REPLACE FUNCTION public.trg_referral_qualify_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    PERFORM public.process_referral_qualification(NEW.organization_id, NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_qualify_on_payment ON public.subscription_invoices;
CREATE TRIGGER trg_referral_qualify_on_payment
  AFTER UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_qualify_on_payment();

-- 4) Balance view
CREATE OR REPLACE VIEW public.v_referral_credit_balance AS
SELECT
  organization_id,
  currency,
  COALESCE(SUM(CASE WHEN status='available' THEN amount END), 0) AS available_amount,
  COALESCE(SUM(CASE WHEN status='consumed'  THEN amount END), 0) AS consumed_amount,
  COALESCE(SUM(CASE WHEN status='expired'   THEN amount END), 0) AS expired_amount,
  COUNT(*) FILTER (WHERE status='available') AS available_count
FROM public.referral_credits
GROUP BY organization_id, currency;

GRANT SELECT ON public.v_referral_credit_balance TO authenticated;
