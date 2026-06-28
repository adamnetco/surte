
-- ========== OLA 18 · Slice 1: Dunning schema + apertura de caso ==========

-- 1) dunning_cases
CREATE TABLE IF NOT EXISTS public.dunning_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','recovered','written_off','paused','canceled_nonpayment')),
  failure_reason TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  total_amount_cop NUMERIC(14,2) NOT NULL DEFAULT 0,
  grace_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_id)
);

GRANT SELECT ON public.dunning_cases TO authenticated;
GRANT ALL ON public.dunning_cases TO service_role;
ALTER TABLE public.dunning_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant admin/owner read own dunning cases"
ON public.dunning_cases FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = dunning_cases.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "superadmin reads all dunning cases"
ON public.dunning_cases FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "superadmin updates dunning cases"
ON public.dunning_cases FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_dunning_cases_open_retry ON public.dunning_cases (status, next_retry_at) WHERE status = 'open';
CREATE INDEX idx_dunning_cases_org ON public.dunning_cases (organization_id, status);

-- 2) dunning_attempts
CREATE TABLE IF NOT EXISTS public.dunning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.dunning_cases(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('approved','declined','error','skipped','pending')),
  wompi_transaction_id TEXT,
  error_code TEXT,
  error_message TEXT,
  amount_cop NUMERIC(14,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, attempt_no)
);

GRANT SELECT ON public.dunning_attempts TO authenticated;
GRANT ALL ON public.dunning_attempts TO service_role;
ALTER TABLE public.dunning_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant admin/owner read own dunning attempts"
ON public.dunning_attempts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dunning_cases dc
    JOIN public.organization_members om ON om.organization_id = dc.organization_id
    WHERE dc.id = dunning_attempts.case_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "superadmin reads all dunning attempts"
ON public.dunning_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_dunning_attempts_case ON public.dunning_attempts (case_id, attempt_no);

-- 3) trigger updated_at
CREATE TRIGGER trg_dunning_cases_updated_at
BEFORE UPDATE ON public.dunning_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) grace_period_days en saas_plans (default 7)
ALTER TABLE public.saas_plans ADD COLUMN IF NOT EXISTS grace_period_days INT NOT NULL DEFAULT 7;

-- 5) RPC dunning_open_case (idempotente)
CREATE OR REPLACE FUNCTION public.dunning_open_case(
  p_org_id UUID,
  p_subscription_id UUID,
  p_invoice_id UUID,
  p_reason TEXT,
  p_amount_cop NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
  v_grace_days INT;
BEGIN
  -- Idempotente por (org, invoice)
  SELECT id INTO v_case_id FROM public.dunning_cases
  WHERE organization_id = p_org_id AND invoice_id = p_invoice_id AND status = 'open'
  LIMIT 1;

  IF v_case_id IS NOT NULL THEN
    RETURN v_case_id;
  END IF;

  -- Grace period del plan
  SELECT COALESCE(sp.grace_period_days, 7) INTO v_grace_days
  FROM public.subscriptions s
  LEFT JOIN public.saas_plans sp ON sp.plan_key = s.plan_key
  WHERE s.id = p_subscription_id;

  v_grace_days := COALESCE(v_grace_days, 7);

  INSERT INTO public.dunning_cases (
    organization_id, subscription_id, invoice_id, status,
    failure_reason, attempt_count, next_retry_at, total_amount_cop, grace_until
  ) VALUES (
    p_org_id, p_subscription_id, p_invoice_id, 'open',
    p_reason, 0, now() + interval '1 day', COALESCE(p_amount_cop, 0),
    now() + (v_grace_days || ' days')::interval
  )
  RETURNING id INTO v_case_id;

  -- Marca suscripción past_due
  IF p_subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET status = 'past_due', updated_at = now()
    WHERE id = p_subscription_id AND status NOT IN ('canceled','past_due');
  END IF;

  RETURN v_case_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dunning_open_case(UUID,UUID,UUID,TEXT,NUMERIC) TO service_role;

-- 6) Vista resumen
CREATE OR REPLACE VIEW public.v_dunning_summary AS
SELECT
  organization_id,
  COUNT(*) FILTER (WHERE status='open') AS open_cases,
  COUNT(*) FILTER (WHERE status='recovered') AS recovered_cases,
  COUNT(*) FILTER (WHERE status IN ('paused','canceled_nonpayment')) AS lost_cases,
  COALESCE(SUM(total_amount_cop) FILTER (WHERE status='open'), 0) AS mrr_at_risk_cop,
  COALESCE(SUM(total_amount_cop) FILTER (WHERE status='recovered' AND closed_at > now() - interval '30 days'), 0) AS recovered_30d_cop,
  MAX(opened_at) AS last_opened_at
FROM public.dunning_cases
GROUP BY organization_id;

GRANT SELECT ON public.v_dunning_summary TO authenticated;
