
-- 1. FK licenses → subscriptions
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_subscription ON public.licenses(subscription_id);

-- 2. Auto-renewal function
CREATE OR REPLACE FUNCTION public.auto_renew_subscriptions()
RETURNS TABLE(subscription_id uuid, organization_id uuid, new_period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_new_end timestamptz;
BEGIN
  FOR r IN
    SELECT s.id, s.organization_id, s.billing_cycle, s.current_period_end
    FROM public.subscriptions s
    WHERE s.status = 'active'
      AND s.cancel_at_period_end = false
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end <= now()
  LOOP
    v_new_end := CASE
      WHEN r.billing_cycle = 'annual' THEN r.current_period_end + interval '1 year'
      ELSE r.current_period_end + interval '1 month'
    END;

    UPDATE public.subscriptions
       SET current_period_start = r.current_period_end,
           current_period_end = v_new_end,
           updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.tenant_audit_log(organization_id, action, payload)
    VALUES (r.organization_id, 'subscription_auto_renewed',
            jsonb_build_object('subscription_id', r.id, 'new_period_end', v_new_end, 'billing_cycle', r.billing_cycle));

    subscription_id := r.id;
    organization_id := r.organization_id;
    new_period_end := v_new_end;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_renew_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_renew_subscriptions() TO service_role;

-- 3. Expire overdue (cancel_at_period_end = true) → past_due + lifecycle sync
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS TABLE(subscription_id uuid, organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT s.id, s.organization_id
    FROM public.subscriptions s
    WHERE s.status = 'active'
      AND s.cancel_at_period_end = true
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end <= now()
  LOOP
    UPDATE public.subscriptions
       SET status = 'past_due', updated_at = now()
     WHERE id = r.id;

    UPDATE public.organizations
       SET lifecycle_state = 'past_due', updated_at = now()
     WHERE id = r.organization_id
       AND lifecycle_state IN ('active','trial');

    INSERT INTO public.tenant_audit_log(organization_id, action, payload)
    VALUES (r.organization_id, 'subscription_expired',
            jsonb_build_object('subscription_id', r.id));

    subscription_id := r.id;
    organization_id := r.organization_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_subscriptions() TO service_role;
