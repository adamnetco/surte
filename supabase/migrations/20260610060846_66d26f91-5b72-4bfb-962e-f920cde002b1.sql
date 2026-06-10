
CREATE TABLE IF NOT EXISTS public.health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('printer','core','wordpress','sites','session')),
  status text NOT NULL,
  prev_status text,
  latency_ms integer,
  message text,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.health_events TO authenticated;
GRANT ALL ON public.health_events TO service_role;

ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_events_read_own_org"
  ON public.health_events FOR SELECT
  TO authenticated
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.can_write_org(organization_id))
    OR organization_id IS NULL AND public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role,'superadmin'::public.app_role])
  );

CREATE INDEX IF NOT EXISTS idx_health_events_org_created
  ON public.health_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_source_created
  ON public.health_events (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_correlation
  ON public.health_events (correlation_id) WHERE correlation_id IS NOT NULL;
