
CREATE TABLE IF NOT EXISTS public.daily_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  item_key TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, day, item_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_checklist_lookup
  ON public.daily_checklist (organization_id, user_id, day);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checklist TO authenticated;
GRANT ALL ON public.daily_checklist TO service_role;

ALTER TABLE public.daily_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily checklist"
  ON public.daily_checklist
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_daily_checklist_updated_at
  BEFORE UPDATE ON public.daily_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
