
-- PLANES
CREATE TABLE IF NOT EXISTS public.saas_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'COP',
  trial_days integer NOT NULL DEFAULT 14,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_public_read" ON public.saas_plans;
CREATE POLICY "plans_public_read" ON public.saas_plans FOR SELECT USING (is_public = true);
DROP POLICY IF EXISTS "plans_superadmin_write" ON public.saas_plans;
CREATE POLICY "plans_superadmin_write" ON public.saas_plans FOR ALL USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

INSERT INTO public.saas_plans(key,name,description,price_monthly,price_yearly,modules,limits,sort_order) VALUES
('free','Free','Para empezar a probar SURTÉ YA POS.',0,0,'["pos_counter"]','{"locations":1,"users":2,"products":50,"einvoices_month":0}',1),
('pro','Pro','POS + inventario multi-bodega + facturación DIAN.',79000,790000,'["pos_counter","pos_tables","inventory_multi_warehouse","einvoice_innapsis"]','{"locations":1,"users":5,"products":2000,"einvoices_month":300}',2),
('business','Business','Multi-sucursal, KDS, reportes avanzados.',169000,1690000,'["pos_counter","pos_tables","kds","inventory_multi_warehouse","einvoice_innapsis","reports_advanced"]','{"locations":5,"users":25,"products":20000,"einvoices_month":2000}',3),
('enterprise','Enterprise','Multi-tenant, integraciones a medida, SLA.',0,0,'["*"]','{"locations":-1,"users":-1,"products":-1,"einvoices_month":-1}',4)
ON CONFLICT (key) DO NOTHING;

-- EXTENDER subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.saas_plans(id),
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_provider text,
  ADD COLUMN IF NOT EXISTS external_id text;

-- Backfill: linkear plan_id por columna 'plan'
UPDATE public.subscriptions s SET plan_id = p.id
FROM public.saas_plans p WHERE s.plan_id IS NULL AND s.plan = p.key;
-- Para los nulos restantes, asignar plan free
UPDATE public.subscriptions s SET plan_id = (SELECT id FROM public.saas_plans WHERE key='free')
WHERE s.plan_id IS NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_read" ON public.subscriptions;
CREATE POLICY "sub_read" ON public.subscriptions FOR SELECT USING (public.is_member_of(organization_id));
DROP POLICY IF EXISTS "sub_write" ON public.subscriptions;
CREATE POLICY "sub_write" ON public.subscriptions FOR ALL
  USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'));

-- Asegurar suscripciones para orgs sin ella (trial 14 días)
INSERT INTO public.subscriptions(organization_id, plan, plan_id, status, trial_ends_at, current_period_end)
SELECT o.id, 'pro', (SELECT id FROM public.saas_plans WHERE key='pro'), 'trial', now()+interval '14 days', now()+interval '14 days'
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.organization_id = o.id);

-- FACTURAS DE SUSCRIPCION
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'COP',
  status text NOT NULL DEFAULT 'open',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  due_date timestamptz NOT NULL,
  paid_at timestamptz,
  external_id text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subinv_read" ON public.subscription_invoices;
CREATE POLICY "subinv_read" ON public.subscription_invoices FOR SELECT USING (public.is_member_of(organization_id));
DROP POLICY IF EXISTS "subinv_admin" ON public.subscription_invoices;
CREATE POLICY "subinv_admin" ON public.subscription_invoices FOR ALL
  USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'));

-- ONBOARDING
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_done boolean NOT NULL DEFAULT false,
  location_done boolean NOT NULL DEFAULT false,
  modules_done boolean NOT NULL DEFAULT false,
  einvoice_done boolean NOT NULL DEFAULT false,
  catalog_done boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "onb_member" ON public.onboarding_progress;
CREATE POLICY "onb_member" ON public.onboarding_progress FOR ALL
  USING (public.is_member_of(organization_id)) WITH CHECK (public.is_member_of(organization_id));

INSERT INTO public.onboarding_progress(organization_id, company_done)
SELECT id, true FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- TICKETS SUSPENDIDOS
CREATE TABLE IF NOT EXISTS public.parked_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  cashier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parked_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parked_member" ON public.parked_tickets;
CREATE POLICY "parked_member" ON public.parked_tickets FOR ALL
  USING (public.is_member_of(organization_id)) WITH CHECK (public.is_member_of(organization_id));
CREATE INDEX IF NOT EXISTS idx_parked_org ON public.parked_tickets(organization_id, created_at DESC);

-- COTIZACIONES
CREATE TABLE IF NOT EXISTS public.pos_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  quote_number serial,
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  valid_until date,
  status text NOT NULL DEFAULT 'open',
  converted_order_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quotes_member" ON public.pos_quotes;
CREATE POLICY "quotes_member" ON public.pos_quotes FOR ALL
  USING (public.is_member_of(organization_id)) WITH CHECK (public.is_member_of(organization_id));
CREATE INDEX IF NOT EXISTS idx_quotes_org ON public.pos_quotes(organization_id, created_at DESC);

-- Triggers updated_at
DROP TRIGGER IF EXISTS trg_plans_uat ON public.saas_plans;
CREATE TRIGGER trg_plans_uat BEFORE UPDATE ON public.saas_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_onb_uat ON public.onboarding_progress;
CREATE TRIGGER trg_onb_uat BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
