
-- =====================================================
-- FASE 1: POS MOSTRADOR (Caja Registradora)
-- =====================================================

-- 1) LOCATIONS (sucursales por organización)
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  address text,
  city text DEFAULT 'Bucaramanga',
  phone text,
  email text,
  timezone text NOT NULL DEFAULT 'America/Bogota',
  is_main boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);
CREATE INDEX idx_locations_org ON public.locations(organization_id) WHERE is_active = true;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read locations" ON public.locations FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "managers manage locations" ON public.locations FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 2) CASH REGISTERS (cajas físicas/virtuales)
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  printer_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_registers_location ON public.cash_registers(location_id) WHERE is_active = true;

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read registers" ON public.cash_registers FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "managers manage registers" ON public.cash_registers FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 3) CASH SESSIONS (turnos de caja)
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  opened_by uuid NOT NULL,
  closed_by uuid,
  opening_amount numeric(14,2) NOT NULL DEFAULT 0,
  expected_amount numeric(14,2) NOT NULL DEFAULT 0,
  closing_amount numeric(14,2),
  difference numeric(14,2),
  total_sales numeric(14,2) NOT NULL DEFAULT 0,
  total_cash numeric(14,2) NOT NULL DEFAULT 0,
  total_card numeric(14,2) NOT NULL DEFAULT 0,
  total_transfer numeric(14,2) NOT NULL DEFAULT 0,
  total_other numeric(14,2) NOT NULL DEFAULT 0,
  ticket_count integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_sessions_register ON public.cash_sessions(cash_register_id, status);
CREATE INDEX idx_cash_sessions_org ON public.cash_sessions(organization_id, opened_at DESC);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read sessions" ON public.cash_sessions FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "operators manage sessions" ON public.cash_sessions FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 4) POS ORDERS (tickets presenciales)
CREATE SEQUENCE IF NOT EXISTS public.pos_ticket_seq START 1;

CREATE TABLE public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL,
  ticket_number integer NOT NULL DEFAULT nextval('public.pos_ticket_seq'),
  customer_profile_id uuid,
  customer_name text,
  customer_phone text,
  customer_document text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  tip numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  change_due numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- draft, paid, voided, refunded
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_orders_session ON public.pos_orders(cash_session_id, created_at DESC);
CREATE INDEX idx_pos_orders_org_date ON public.pos_orders(organization_id, created_at DESC);
CREATE INDEX idx_pos_orders_status ON public.pos_orders(organization_id, status);

ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pos orders" ON public.pos_orders FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "operators manage pos orders" ON public.pos_orders FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 5) POS ORDER ITEMS
CREATE TABLE public.pos_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pos_order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  product_id uuid,
  presentation_id uuid,
  product_name text NOT NULL,
  sku text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_items_order ON public.pos_order_items(pos_order_id);

ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pos items" ON public.pos_order_items FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "operators manage pos items" ON public.pos_order_items FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 6) POS PAYMENTS (split payment)
CREATE TABLE public.pos_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pos_order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  method text NOT NULL, -- efectivo, tarjeta_debito, tarjeta_credito, transferencia, nequi, daviplata, bono, otro
  amount numeric(14,2) NOT NULL,
  reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_payments_order ON public.pos_payments(pos_order_id);
CREATE INDEX idx_pos_payments_session ON public.pos_payments(cash_session_id);

ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pos payments" ON public.pos_payments FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "operators manage pos payments" ON public.pos_payments FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 7) CASH MOVEMENTS (entradas/salidas durante el turno)
CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  movement_type text NOT NULL, -- income, withdrawal, expense, adjustment
  amount numeric(14,2) NOT NULL,
  concept text NOT NULL,
  reference text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_session ON public.cash_movements(cash_session_id);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read movements" ON public.cash_movements FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));

CREATE POLICY "operators manage movements" ON public.cash_movements FOR ALL
USING (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK (org_role(organization_id) IN ('owner','admin','manager','agent') OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- 8) Vincular orders web con location
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS location_id uuid;

-- 9) updated_at triggers
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cash_registers_updated BEFORE UPDATE ON public.cash_registers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cash_sessions_updated BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pos_orders_updated BEFORE UPDATE ON public.pos_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10) Seed: ubicación principal y caja para la org default
INSERT INTO public.locations (organization_id, name, code, city, is_main, is_active)
SELECT id, 'Sede Principal', 'MAIN', 'Bucaramanga', true, true
FROM public.organizations WHERE slug = 'surteya'
ON CONFLICT DO NOTHING;

INSERT INTO public.cash_registers (organization_id, location_id, name, code)
SELECT l.organization_id, l.id, 'Caja 1', 'CAJA-01'
FROM public.locations l
JOIN public.organizations o ON o.id = l.organization_id
WHERE o.slug = 'surteya' AND l.is_main = true
ON CONFLICT DO NOTHING;

-- 11) Activar módulo pos_counter
INSERT INTO public.organization_modules (organization_id, module_key, enabled)
SELECT id, 'pos_counter', true FROM public.organizations WHERE slug = 'surteya'
ON CONFLICT DO NOTHING;
