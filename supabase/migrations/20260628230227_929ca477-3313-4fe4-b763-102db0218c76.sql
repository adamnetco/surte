
-- =====================================================
-- Ola 22 Slice 1: NPS & CSAT schema + trigger engine
-- =====================================================

-- 1) Catalog of survey campaigns (NPS, CSAT, custom)
CREATE TABLE public.survey_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('nps','csat','ces','custom')),
  question TEXT NOT NULL,
  follow_up_question TEXT,
  trigger_event TEXT NOT NULL,           -- 'onboarding_completed','ticket_resolved','recurring_90d','post_invoice_paid'
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  cooldown_days INTEGER NOT NULL DEFAULT 90,
  is_active BOOLEAN NOT NULL DEFAULT true,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {role:[],plan:[],min_age_days:N}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_campaigns TO authenticated;
GRANT ALL ON public.survey_campaigns TO service_role;
ALTER TABLE public.survey_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone authed can read active campaigns"
ON public.survey_campaigns FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "superadmin manages campaigns"
ON public.survey_campaigns FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- 2) Per-user invites (one per trigger event)
CREATE TABLE public.survey_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.survey_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  trigger_event TEXT NOT NULL,
  trigger_ref TEXT,                       -- e.g. ticket_id, invoice_id
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shown','dismissed','answered','expired')),
  shown_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, trigger_ref)
);

CREATE INDEX idx_survey_invites_user_pending ON public.survey_invites(user_id, status) WHERE status = 'pending';
CREATE INDEX idx_survey_invites_campaign ON public.survey_invites(campaign_id);

GRANT SELECT, UPDATE ON public.survey_invites TO authenticated;
GRANT ALL ON public.survey_invites TO service_role;
ALTER TABLE public.survey_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own invites"
ON public.survey_invites FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));

CREATE POLICY "user updates own invites"
ON public.survey_invites FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "superadmin manages all invites"
ON public.survey_invites FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- 3) Responses ledger
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.survey_invites(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.survey_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  score INTEGER NOT NULL,                 -- 0-10 NPS, 1-5 CSAT
  category TEXT,                          -- 'detractor','passive','promoter' for NPS
  comment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_responses_campaign_created ON public.survey_responses(campaign_id, created_at DESC);
CREATE INDEX idx_survey_responses_org ON public.survey_responses(org_id) WHERE org_id IS NOT NULL;

GRANT SELECT, INSERT ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user inserts own response"
ON public.survey_responses FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user reads own response"
ON public.survey_responses FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));

CREATE POLICY "superadmin reads all"
ON public.survey_responses FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- 4) Helper: classify NPS category
CREATE OR REPLACE FUNCTION public.nps_category(score INTEGER)
RETURNS TEXT
LANGUAGE SQL IMMUTABLE
AS $$
  SELECT CASE
    WHEN score >= 9 THEN 'promoter'
    WHEN score >= 7 THEN 'passive'
    ELSE 'detractor'
  END;
$$;

-- 5) RPC: get next pending invite for the current user
CREATE OR REPLACE FUNCTION public.get_pending_survey()
RETURNS TABLE (
  invite_id UUID,
  campaign_id UUID,
  code TEXT,
  type TEXT,
  question TEXT,
  follow_up_question TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, c.id, c.code, c.type, c.question, c.follow_up_question
  FROM public.survey_invites i
  JOIN public.survey_campaigns c ON c.id = i.campaign_id
  WHERE i.user_id = auth.uid()
    AND i.status = 'pending'
    AND i.expires_at > now()
    AND c.is_active = true
  ORDER BY i.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_survey() TO authenticated;

-- 6) RPC: submit a response (atomic invite update + insert)
CREATE OR REPLACE FUNCTION public.submit_survey_response(
  p_invite_id UUID,
  p_score INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.survey_invites%ROWTYPE;
  v_campaign public.survey_campaigns%ROWTYPE;
  v_response_id UUID;
  v_cat TEXT;
BEGIN
  SELECT * INTO v_invite FROM public.survey_invites
    WHERE id = p_invite_id AND user_id = auth.uid()
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF v_invite.status IN ('answered','expired') THEN
    RAISE EXCEPTION 'invite_already_closed';
  END IF;

  SELECT * INTO v_campaign FROM public.survey_campaigns WHERE id = v_invite.campaign_id;

  -- Validate score range
  IF v_campaign.type = 'nps' AND (p_score < 0 OR p_score > 10) THEN
    RAISE EXCEPTION 'nps_score_out_of_range';
  END IF;
  IF v_campaign.type IN ('csat','ces') AND (p_score < 1 OR p_score > 5) THEN
    RAISE EXCEPTION 'csat_score_out_of_range';
  END IF;

  IF v_campaign.type = 'nps' THEN
    v_cat := public.nps_category(p_score);
  END IF;

  INSERT INTO public.survey_responses(invite_id, campaign_id, user_id, org_id, score, category, comment)
  VALUES (v_invite.id, v_invite.campaign_id, auth.uid(), v_invite.org_id, p_score, v_cat, p_comment)
  RETURNING id INTO v_response_id;

  UPDATE public.survey_invites
    SET status = 'answered', answered_at = now()
    WHERE id = v_invite.id;

  RETURN v_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_survey_response(UUID, INTEGER, TEXT) TO authenticated;

-- 7) RPC: dismiss an invite (mark as dismissed, can re-show after cooldown if engine re-issues)
CREATE OR REPLACE FUNCTION public.dismiss_survey_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.survey_invites
    SET status = 'dismissed'
    WHERE id = p_invite_id AND user_id = auth.uid() AND status IN ('pending','shown');
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_survey_invite(UUID) TO authenticated;

-- 8) Enqueue helper: idempotent invite creation respecting cooldown
CREATE OR REPLACE FUNCTION public.enqueue_survey_invite(
  p_campaign_code TEXT,
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_trigger_event TEXT DEFAULT NULL,
  p_trigger_ref TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign public.survey_campaigns%ROWTYPE;
  v_invite_id UUID;
  v_recent_count INTEGER;
BEGIN
  SELECT * INTO v_campaign FROM public.survey_campaigns
    WHERE code = p_campaign_code AND is_active = true;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Cooldown: skip if user answered ANY invite of this campaign recently
  SELECT COUNT(*) INTO v_recent_count
  FROM public.survey_invites
  WHERE campaign_id = v_campaign.id
    AND user_id = p_user_id
    AND answered_at IS NOT NULL
    AND answered_at > now() - (v_campaign.cooldown_days || ' days')::interval;
  IF v_recent_count > 0 THEN RETURN NULL; END IF;

  INSERT INTO public.survey_invites(campaign_id, user_id, org_id, trigger_event, trigger_ref)
  VALUES (v_campaign.id, p_user_id, p_org_id, COALESCE(p_trigger_event, v_campaign.trigger_event), p_trigger_ref)
  ON CONFLICT (campaign_id, user_id, trigger_ref) DO NOTHING
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_survey_invite(TEXT, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- 9) Seed 2 default campaigns
INSERT INTO public.survey_campaigns (code, name, type, question, follow_up_question, trigger_event, cooldown_days)
VALUES
  ('nps_quarterly', 'NPS trimestral', 'nps',
   '¿Qué tan probable es que recomiendes SistecPOS a un colega?',
   'Cuéntanos por qué (opcional)',
   'recurring_90d', 90),
  ('csat_support', 'CSAT post-soporte', 'csat',
   '¿Qué tan satisfecho quedaste con la atención?',
   '¿Algo que podamos mejorar?',
   'ticket_resolved', 30)
ON CONFLICT (code) DO NOTHING;

-- 10) updated_at trigger
CREATE TRIGGER trg_survey_campaigns_updated
  BEFORE UPDATE ON public.survey_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
