ALTER TYPE public.lifecycle_sequence ADD VALUE IF NOT EXISTS 'cancellation_followup';

CREATE OR REPLACE FUNCTION public.trg_enroll_cancellation_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_user_id uuid;
BEGIN
  -- Resolve owner email from the cancelling user, then from any admin/owner.
  IF NEW.user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    v_user_id := NEW.user_id;
  END IF;

  IF v_email IS NULL THEN
    SELECT u.id, u.email INTO v_user_id, v_email
    FROM public.organization_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = NEW.organization_id
      AND m.is_active = true
      AND m.role IN ('owner','admin')
    ORDER BY m.joined_at ASC
    LIMIT 1;
  END IF;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.lifecycle_enrollments(
    organization_id, user_id, recipient_email, sequence, status,
    current_step, next_send_at, context
  ) VALUES (
    NEW.organization_id, v_user_id, v_email, 'cancellation_followup', 'active',
    0, now() + interval '7 days',
    jsonb_build_object(
      'reason_code', NEW.reason_code,
      'competitor', NEW.competitor,
      'plan_at_cancel', NEW.plan_at_cancel,
      'mrr_at_cancel', NEW.mrr_at_cancel
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_cancellations_enroll ON public.subscription_cancellations;
CREATE TRIGGER trg_subscription_cancellations_enroll
AFTER INSERT ON public.subscription_cancellations
FOR EACH ROW EXECUTE FUNCTION public.trg_enroll_cancellation_followup();