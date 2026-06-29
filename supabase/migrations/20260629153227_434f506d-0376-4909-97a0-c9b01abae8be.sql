
CREATE TABLE public.routing_alert_timeline_preset_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid,
  preset_name text,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  actor_id uuid,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.routing_alert_timeline_preset_audit TO authenticated;
GRANT ALL ON public.routing_alert_timeline_preset_audit TO service_role;

ALTER TABLE public.routing_alert_timeline_preset_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins read preset audit"
  ON public.routing_alert_timeline_preset_audit FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "system inserts preset audit"
  ON public.routing_alert_timeline_preset_audit FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_routing_alert_preset_audit_created_at
  ON public.routing_alert_timeline_preset_audit (created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_routing_alert_preset_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_diff jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('new', to_jsonb(NEW));
    INSERT INTO public.routing_alert_timeline_preset_audit(preset_id, preset_name, action, actor_id, diff)
    VALUES (NEW.id, NEW.name, 'create', v_actor, v_diff);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    INSERT INTO public.routing_alert_timeline_preset_audit(preset_id, preset_name, action, actor_id, diff)
    VALUES (NEW.id, NEW.name, 'update', v_actor, v_diff);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_diff := jsonb_build_object('old', to_jsonb(OLD));
    INSERT INTO public.routing_alert_timeline_preset_audit(preset_id, preset_name, action, actor_id, diff)
    VALUES (OLD.id, OLD.name, 'delete', v_actor, v_diff);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS routing_alert_preset_audit_trg ON public.routing_alert_timeline_presets;
CREATE TRIGGER routing_alert_preset_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.routing_alert_timeline_presets
FOR EACH ROW EXECUTE FUNCTION public.trg_routing_alert_preset_audit();
