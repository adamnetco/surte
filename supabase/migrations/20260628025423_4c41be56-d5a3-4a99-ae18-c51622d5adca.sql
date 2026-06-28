-- Lifecycle sequences (closed list)
DO $$ BEGIN
  CREATE TYPE public.lifecycle_sequence AS ENUM (
    'trial_onboarding',
    'trial_ending',
    'payment_recovered',
    'winback_inactive',
    'approaching_limit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lifecycle_status AS ENUM ('active','completed','suppressed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.lifecycle_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  recipient_email TEXT NOT NULL,
  sequence public.lifecycle_sequence NOT NULL,
  status public.lifecycle_status NOT NULL DEFAULT 'active',
  current_step INT NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sequence, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_enrollments_due
  ON public.lifecycle_enrollments (status, next_send_at)
  WHERE status = 'active';

GRANT SELECT ON public.lifecycle_enrollments TO authenticated;
GRANT ALL ON public.lifecycle_enrollments TO service_role;
ALTER TABLE public.lifecycle_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins read lifecycle_enrollments"
  ON public.lifecycle_enrollments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Service role manages lifecycle_enrollments"
  ON public.lifecycle_enrollments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lifecycle_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.lifecycle_enrollments(id) ON DELETE CASCADE,
  sequence public.lifecycle_sequence NOT NULL,
  step INT NOT NULL,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_sends_enrollment
  ON public.lifecycle_sends (enrollment_id, step);

GRANT SELECT ON public.lifecycle_sends TO authenticated;
GRANT ALL ON public.lifecycle_sends TO service_role;
ALTER TABLE public.lifecycle_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins read lifecycle_sends"
  ON public.lifecycle_sends FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Service role manages lifecycle_sends"
  ON public.lifecycle_sends FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_lifecycle_enrollments_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_lifecycle_enrollments_touch ON public.lifecycle_enrollments;
CREATE TRIGGER trg_lifecycle_enrollments_touch
  BEFORE UPDATE ON public.lifecycle_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_lifecycle_enrollments_touch();

-- Auto-enroll on new trial subscription
CREATE OR REPLACE FUNCTION public.tg_enroll_trial_onboarding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NEW.status IN ('trialing','trial') OR NEW.trial_ends_at IS NOT NULL THEN
    SELECT o.email INTO v_email FROM public.organizations o WHERE o.id = NEW.organization_id;
    IF v_email IS NOT NULL THEN
      INSERT INTO public.lifecycle_enrollments
        (organization_id, recipient_email, sequence, next_send_at, context)
      VALUES (
        NEW.organization_id, v_email, 'trial_onboarding',
        now() + interval '1 day',
        jsonb_build_object('subscription_id', NEW.id, 'trial_ends_at', NEW.trial_ends_at)
      )
      ON CONFLICT (organization_id, sequence, recipient_email) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enroll_trial_onboarding ON public.subscriptions;
CREATE TRIGGER trg_enroll_trial_onboarding
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_enroll_trial_onboarding();

-- Auto-enroll winback when cancellation scheduled
CREATE OR REPLACE FUNCTION public.tg_enroll_winback_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email TEXT;
BEGIN
  IF NEW.outcome = 'scheduled_cancel' THEN
    SELECT o.email INTO v_email FROM public.organizations o WHERE o.id = NEW.organization_id;
    IF v_email IS NOT NULL THEN
      INSERT INTO public.lifecycle_enrollments
        (organization_id, recipient_email, sequence, next_send_at, context)
      VALUES (
        NEW.organization_id, v_email, 'winback_inactive',
        now() + interval '30 days',
        jsonb_build_object('reason_code', NEW.reason_code, 'cancellation_id', NEW.id)
      )
      ON CONFLICT (organization_id, sequence, recipient_email) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enroll_winback_on_cancel ON public.subscription_cancellations;
CREATE TRIGGER trg_enroll_winback_on_cancel
  AFTER INSERT ON public.subscription_cancellations
  FOR EACH ROW EXECUTE FUNCTION public.tg_enroll_winback_on_cancel();