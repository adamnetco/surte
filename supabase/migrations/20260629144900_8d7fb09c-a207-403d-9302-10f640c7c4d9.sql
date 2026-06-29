
CREATE TABLE IF NOT EXISTS public.routing_alert_timeline_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routing_alert_timeline_presets TO authenticated;
GRANT ALL ON public.routing_alert_timeline_presets TO service_role;

ALTER TABLE public.routing_alert_timeline_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins read team presets"
  ON public.routing_alert_timeline_presets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "superadmins insert team presets"
  ON public.routing_alert_timeline_presets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') AND created_by = auth.uid());

CREATE POLICY "superadmins update team presets"
  ON public.routing_alert_timeline_presets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "superadmins delete team presets"
  ON public.routing_alert_timeline_presets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_routing_alert_timeline_presets_updated_at
  BEFORE UPDATE ON public.routing_alert_timeline_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
