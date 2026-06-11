
-- 1) Add organization_id columns (nullable initially to allow backfill)
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.push_broadcast_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2) Backfill from organization_members (best-effort: pick the user's first active membership)
UPDATE public.push_subscriptions ps
SET organization_id = om.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  WHERE is_active = true
  ORDER BY user_id, created_at ASC
) om
WHERE ps.user_id = om.user_id AND ps.organization_id IS NULL;

UPDATE public.push_broadcast_logs pbl
SET organization_id = om.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  WHERE is_active = true
  ORDER BY user_id, created_at ASC
) om
WHERE pbl.sent_by = om.user_id AND pbl.organization_id IS NULL;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_org ON public.push_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_push_broadcast_logs_org ON public.push_broadcast_logs(organization_id);

-- 4) Drop old policies & recreate scoped policies for push_subscriptions
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='push_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "users manage own push subs"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "org admins read push subs"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = public.push_subscriptions.organization_id
        AND user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner','admin')
    )
  );

-- 5) Drop old policies & recreate scoped policies for push_broadcast_logs
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='push_broadcast_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_broadcast_logs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "org members read broadcast logs"
  ON public.push_broadcast_logs FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = public.push_broadcast_logs.organization_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "service role writes broadcast logs"
  ON public.push_broadcast_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- 6) Ensure grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.push_broadcast_logs TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.push_broadcast_logs TO service_role;
