
-- Cancellation feedback (retention analytics + reason codes)
CREATE TABLE IF NOT EXISTS public.subscription_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason_code text NOT NULL CHECK (reason_code IN (
    'too_expensive','missing_feature','too_complex','bug_or_quality',
    'switching_competitor','temporary_pause','not_using','other'
  )),
  reason_detail text,
  offer_shown text,
  offer_accepted boolean NOT NULL DEFAULT false,
  outcome text NOT NULL CHECK (outcome IN ('scheduled_cancel','retained','pending')),
  competitor text,
  plan_at_cancel text,
  mrr_at_cancel numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.subscription_cancellations TO authenticated;
GRANT ALL ON public.subscription_cancellations TO service_role;

ALTER TABLE public.subscription_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view own org cancellations"
  ON public.subscription_cancellations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'superadmin')
    OR EXISTS (SELECT 1 FROM public.organization_members m
               WHERE m.organization_id = subscription_cancellations.organization_id
                 AND m.user_id = auth.uid())
  );

CREATE POLICY "owners/admins can insert cancellations"
  ON public.subscription_cancellations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'superadmin')
    OR EXISTS (SELECT 1 FROM public.organization_members m
               WHERE m.organization_id = subscription_cancellations.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

CREATE POLICY "owners/admins can update cancellations"
  ON public.subscription_cancellations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'superadmin')
    OR EXISTS (SELECT 1 FROM public.organization_members m
               WHERE m.organization_id = subscription_cancellations.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

CREATE INDEX IF NOT EXISTS idx_cancellations_org ON public.subscription_cancellations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancellations_reason ON public.subscription_cancellations(reason_code, created_at DESC);
