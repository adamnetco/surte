ALTER TABLE public.routing_alert_timeline_presets
  ADD COLUMN IF NOT EXISTS is_team_default boolean NOT NULL DEFAULT false;

-- Solo un preset puede estar marcado como default de equipo a la vez
CREATE UNIQUE INDEX IF NOT EXISTS routing_alert_timeline_presets_one_default
  ON public.routing_alert_timeline_presets ((is_team_default))
  WHERE is_team_default = true;