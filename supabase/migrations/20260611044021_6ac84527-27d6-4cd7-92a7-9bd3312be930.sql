
-- Etapa 17 — multi-tenant para notification_subscriptions y broadcast_logs + perf indexes

-- 1. notification_subscriptions: organization_id + backfill + RLS
ALTER TABLE public.notification_subscriptions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- backfill desde profiles del user
UPDATE public.notification_subscriptions ns
   SET organization_id = p.organization_id
  FROM public.profiles p
 WHERE ns.user_id = p.user_id AND ns.organization_id IS NULL AND p.organization_id IS NOT NULL;

-- fallback al primer org activo (no rompe nada si quedan NULL)
CREATE INDEX IF NOT EXISTS idx_notification_subs_org
  ON public.notification_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_subs_org_active
  ON public.notification_subscriptions(organization_id, is_active);

-- reescribir RLS — admin solo ve subs de su org
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.notification_subscriptions;
CREATE POLICY "Admins manage subs of their org"
  ON public.notification_subscriptions
  FOR ALL
  TO authenticated
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.can_write_org(organization_id))
  )
  WITH CHECK (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.can_write_org(organization_id))
  );

-- 2. broadcast_logs: organization_id + RLS + index
ALTER TABLE public.broadcast_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.broadcast_logs bl
   SET organization_id = p.organization_id
  FROM public.profiles p
 WHERE bl.sent_by = p.user_id AND bl.organization_id IS NULL AND p.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_org
  ON public.broadcast_logs(organization_id, created_at DESC);

DROP POLICY IF EXISTS "Admins can manage broadcast_logs" ON public.broadcast_logs;
CREATE POLICY "Admins manage broadcasts of their org"
  ON public.broadcast_logs
  FOR ALL
  TO authenticated
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.can_write_org(organization_id))
  )
  WITH CHECK (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.can_write_org(organization_id))
  );

-- 3. Performance indexes en tablas hot que faltaban (organization_id, ...)
CREATE INDEX IF NOT EXISTS idx_print_jobs_org_status
  ON public.print_jobs(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_payments_org
  ON public.pos_payments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_table_order_items_org
  ON public.table_order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_org
  ON public.pos_order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org
  ON public.order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_active
  ON public.products(organization_id, is_active);
