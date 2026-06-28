
-- New campaign for onboarding NPS
INSERT INTO public.survey_campaigns (code, name, type, question, follow_up_question, trigger_event, cooldown_days)
VALUES ('nps_post_onboarding', 'NPS post-onboarding', 'nps',
  '¿Qué tan probable es que recomiendes SistecPOS tras tu configuración inicial?',
  '¿Qué hizo la diferencia? (opcional)',
  'onboarding_completed', 180)
ON CONFLICT (code) DO NOTHING;

-- Trigger 1: ticket resolved → CSAT
CREATE OR REPLACE FUNCTION public.trg_survey_on_ticket_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved','closed','solucionado','cerrado')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.user_id IS NOT NULL THEN
    PERFORM public.enqueue_survey_invite(
      'csat_support', NEW.user_id, NULL, 'ticket_resolved', NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_survey_ticket_resolved ON public.client_tickets;
CREATE TRIGGER trg_survey_ticket_resolved
  AFTER UPDATE OF status ON public.client_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_survey_on_ticket_resolved();

-- Trigger 2: onboarding completed → NPS to org owners/admins
CREATE OR REPLACE FUNCTION public.trg_survey_on_onboarding_done()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member RECORD;
BEGIN
  -- Fire when completed_at transitions from NULL to NOT NULL
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    FOR v_member IN
      SELECT user_id FROM public.organization_members
      WHERE org_id = NEW.organization_id
        AND role IN ('owner','admin')
    LOOP
      PERFORM public.enqueue_survey_invite(
        'nps_post_onboarding', v_member.user_id, NEW.organization_id,
        'onboarding_completed', NEW.id::text
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_survey_onboarding_done ON public.onboarding_progress;
CREATE TRIGGER trg_survey_onboarding_done
  AFTER UPDATE OF completed_at ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_survey_on_onboarding_done();

-- Recurring 90d NPS enqueuer (called by pg_cron)
CREATE OR REPLACE FUNCTION public.enqueue_recurring_nps()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
  v_invite_id UUID;
BEGIN
  -- Target: org owners/admins whose account is ≥30 days old
  FOR v_user IN
    SELECT DISTINCT om.user_id, om.org_id
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.role IN ('owner','admin')
      AND u.created_at < now() - interval '30 days'
  LOOP
    SELECT public.enqueue_survey_invite(
      'nps_quarterly', v_user.user_id, v_user.org_id,
      'recurring_90d',
      'q' || to_char(now(), 'YYYY-Q')
    ) INTO v_invite_id;
    IF v_invite_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_recurring_nps() TO service_role;
