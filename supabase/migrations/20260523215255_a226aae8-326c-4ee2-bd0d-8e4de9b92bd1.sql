
-- Fase 10: módulos por plan, metering y dunning

-- 1) Composición plan ↔ módulos (qué módulos incluye cada plan SaaS)
CREATE TABLE IF NOT EXISTS public.plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  included boolean NOT NULL DEFAULT true,
  quota_limit integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, module_key)
);
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_modules read all"  ON public.plan_modules FOR SELECT USING (true);
CREATE POLICY "plan_modules manage superadmin" ON public.plan_modules FOR ALL
  USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- 2) Eventos de uso (metering por organización, módulo y métrica)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  metric text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_org_time ON public.usage_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_module_metric ON public.usage_events(module_key, metric);
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage read members" ON public.usage_events FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "usage insert members" ON public.usage_events FOR INSERT WITH CHECK (is_member_of(organization_id));

-- 3) Dunning (gestión de cobros fallidos / reintentos)
CREATE TABLE IF NOT EXISTS public.dunning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  attempt int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending', -- pending|retry|recovered|failed|written_off
  reason text,
  next_retry_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dunning_status_next ON public.dunning_events(status, next_retry_at);
ALTER TABLE public.dunning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning read members" ON public.dunning_events FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "dunning manage superadmin" ON public.dunning_events FOR ALL
  USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- 4) Token simple para que el plugin WP autentique contra Sistecpos
ALTER TABLE public.tenant_wp_config
  ADD COLUMN IF NOT EXISTS plugin_token text DEFAULT encode(gen_random_bytes(24),'hex');

-- 5) Helper: registrar uso desde cualquier parte de la app
CREATE OR REPLACE FUNCTION public.log_usage(_org_id uuid, _module text, _metric text, _qty numeric DEFAULT 1, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_member_of(_org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.usage_events(organization_id, module_key, metric, quantity, user_id, metadata)
  VALUES (_org_id, _module, _metric, COALESCE(_qty,1), auth.uid(), COALESCE(_meta,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
