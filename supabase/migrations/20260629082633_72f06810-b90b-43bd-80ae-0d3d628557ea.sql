CREATE TABLE public.routing_alert_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('rule','printer')),
  target_id UUID NOT NULL,
  notified_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','both')),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, target_kind, target_id, notified_on)
);

GRANT SELECT ON public.routing_alert_notifications TO authenticated;
GRANT ALL ON public.routing_alert_notifications TO service_role;

ALTER TABLE public.routing_alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read routing alert notifications"
  ON public.routing_alert_notifications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = routing_alert_notifications.organization_id
      AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_routing_alert_notifications_org_day
  ON public.routing_alert_notifications (organization_id, notified_on DESC);