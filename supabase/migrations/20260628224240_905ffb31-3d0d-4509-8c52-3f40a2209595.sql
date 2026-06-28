
-- Slice 4: aplicar créditos de referido automáticamente al emitir factura
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS credit_applied_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_referral_credits_to_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.subscription_invoices%ROWTYPE;
  v_remaining numeric;
  v_applied_total numeric := 0;
  v_credit RECORD;
  v_take numeric;
BEGIN
  SELECT * INTO v_invoice FROM public.subscription_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invoice_not_found'); END IF;
  IF v_invoice.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invoice_not_pending'); END IF;
  IF COALESCE(v_invoice.credit_applied_amount, 0) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_applied');
  END IF;

  v_remaining := GREATEST(COALESCE(v_invoice.amount, 0) - 0, 0);
  IF v_remaining <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'zero_amount'); END IF;

  FOR v_credit IN
    SELECT * FROM public.referral_credits
    WHERE organization_id = v_invoice.organization_id
      AND status = 'available'
      AND currency = v_invoice.currency
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_credit.amount, v_remaining);

    IF v_take >= v_credit.amount THEN
      UPDATE public.referral_credits
        SET status = 'consumed',
            consumed_at = now(),
            consumed_invoice_id = v_invoice.id,
            updated_at = now()
        WHERE id = v_credit.id;
    ELSE
      -- consumo parcial: marcar consumido y dejar remanente como nuevo crédito
      UPDATE public.referral_credits
        SET status = 'consumed',
            amount = v_take,
            consumed_at = now(),
            consumed_invoice_id = v_invoice.id,
            updated_at = now()
        WHERE id = v_credit.id;

      INSERT INTO public.referral_credits
        (organization_id, conversion_id, amount, currency, status, reason, expires_at, metadata)
      VALUES
        (v_credit.organization_id, v_credit.conversion_id,
         v_credit.amount - v_take, v_credit.currency, 'available',
         COALESCE(v_credit.reason, 'referral_split_remainder'),
         v_credit.expires_at,
         COALESCE(v_credit.metadata, '{}'::jsonb) || jsonb_build_object('split_from', v_credit.id));
    END IF;

    v_applied_total := v_applied_total + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_applied_total > 0 THEN
    UPDATE public.subscription_invoices
      SET credit_applied_amount = v_applied_total,
          credit_applied_at = now(),
          amount = GREATEST(amount - v_applied_total, 0)
      WHERE id = v_invoice.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'applied_amount', v_applied_total,
    'remaining_invoice_amount', v_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_credits_to_invoice(uuid) TO authenticated, service_role;

-- Trigger automático al insertar factura pendiente
CREATE OR REPLACE FUNCTION public.trg_auto_apply_referral_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' AND COALESCE(NEW.credit_applied_amount, 0) = 0 THEN
    PERFORM public.apply_referral_credits_to_invoice(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_invoices_apply_credits ON public.subscription_invoices;
CREATE TRIGGER trg_subscription_invoices_apply_credits
AFTER INSERT ON public.subscription_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_apply_referral_credits();
