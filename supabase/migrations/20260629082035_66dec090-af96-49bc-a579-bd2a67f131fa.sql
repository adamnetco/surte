CREATE TABLE public.routing_alert_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('rule','printer')),
  target_id UUID NOT NULL,
  reason TEXT,
  muted_until TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, target_kind, target_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routing_alert_mutes TO authenticated;
GRANT ALL ON public.routing_alert_mutes TO service_role;

ALTER TABLE public.routing_alert_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read mutes"
  ON public.routing_alert_mutes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = routing_alert_mutes.organization_id
      AND om.user_id = auth.uid()
  ));

CREATE POLICY "admins manage mutes"
  ON public.routing_alert_mutes FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = routing_alert_mutes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = routing_alert_mutes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','manager')
  ));

CREATE INDEX idx_routing_alert_mutes_org_until
  ON public.routing_alert_mutes (organization_id, muted_until);

CREATE TRIGGER trg_routing_alert_mutes_updated
  BEFORE UPDATE ON public.routing_alert_mutes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();