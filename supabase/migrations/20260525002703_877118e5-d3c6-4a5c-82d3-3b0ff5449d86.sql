
-- =========================================================
-- 1) sync_outbox
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL,                -- 'wp_product' | 'wp_order' | 'wp_revalidate' | 'whatsapp_order_confirmed'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  organization_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending | succeeded | dead
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  succeeded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_due
  ON public.sync_outbox (status, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sync_outbox_org
  ON public.sync_outbox (organization_id, status);

DROP TRIGGER IF EXISTS trg_sync_outbox_updated ON public.sync_outbox;
CREATE TRIGGER trg_sync_outbox_updated
  BEFORE UPDATE ON public.sync_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sync_outbox ENABLE ROW LEVEL SECURITY;

-- Read: org members or superadmin
DROP POLICY IF EXISTS sync_outbox_read ON public.sync_outbox;
CREATE POLICY sync_outbox_read ON public.sync_outbox
  FOR SELECT TO authenticated
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.is_member_of(organization_id))
  );

-- Write: blocked for normal clients (only service_role inserts/updates)
DROP POLICY IF EXISTS sync_outbox_block_writes ON public.sync_outbox;
CREATE POLICY sync_outbox_block_writes ON public.sync_outbox
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- =========================================================
-- 2) can_write_org helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_write_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_master_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = _org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('admin','cashier','owner')
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_org(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_write_org(uuid) TO authenticated;

-- Apply to pos_orders / pos_payments / cash_sessions / cash_movements
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pos_orders','pos_payments','cash_sessions','cash_movements']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write_org ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY %I_write_org ON public.%I
        FOR ALL TO authenticated
        USING (organization_id IS NOT NULL AND public.can_write_org(organization_id))
        WITH CHECK (organization_id IS NOT NULL AND public.can_write_org(organization_id))
    $p$, t, t);
  END LOOP;
END $$;

-- =========================================================
-- 3) cost_price auto-fill
-- =========================================================
INSERT INTO public.app_settings (key, value)
VALUES ('default_cost_margin', to_jsonb('0.35'::text))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fill_default_cost_price()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_margin numeric := 0.35;
  v_raw jsonb;
BEGIN
  IF NEW.cost_price IS NULL AND NEW.price IS NOT NULL THEN
    SELECT value INTO v_raw FROM public.app_settings WHERE key = 'default_cost_margin' LIMIT 1;
    IF v_raw IS NOT NULL THEN
      BEGIN
        v_margin := COALESCE((v_raw #>> '{}')::numeric, 0.35);
      EXCEPTION WHEN OTHERS THEN
        v_margin := 0.35;
      END;
    END IF;
    NEW.cost_price := round(NEW.price * (1 - v_margin), 2);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_default_cost_price ON public.products;
CREATE TRIGGER trg_fill_default_cost_price
  BEFORE INSERT OR UPDATE OF price, cost_price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fill_default_cost_price();

-- =========================================================
-- 4) Cash denominations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cash_denominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value numeric NOT NULL,
  kind text NOT NULL DEFAULT 'bill', -- 'bill' | 'coin'
  currency text NOT NULL DEFAULT 'COP',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (currency, value)
);

ALTER TABLE public.cash_denominations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_denoms_read ON public.cash_denominations;
CREATE POLICY cash_denoms_read ON public.cash_denominations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cash_denoms_admin_write ON public.cash_denominations;
CREATE POLICY cash_denoms_admin_write ON public.cash_denominations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

INSERT INTO public.cash_denominations (value, kind, currency, sort_order) VALUES
  (50,'coin','COP',1),(100,'coin','COP',2),(200,'coin','COP',3),(500,'coin','COP',4),(1000,'coin','COP',5),
  (2000,'bill','COP',6),(5000,'bill','COP',7),(10000,'bill','COP',8),
  (20000,'bill','COP',9),(50000,'bill','COP',10),(100000,'bill','COP',11)
ON CONFLICT (currency, value) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cash_session_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  denomination_id uuid NOT NULL REFERENCES public.cash_denominations(id),
  quantity int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  kind text NOT NULL DEFAULT 'close', -- 'open' | 'close'
  organization_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, denomination_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_cash_session_counts_session
  ON public.cash_session_counts (session_id);

ALTER TABLE public.cash_session_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csc_read ON public.cash_session_counts;
CREATE POLICY csc_read ON public.cash_session_counts
  FOR SELECT TO authenticated
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.is_member_of(organization_id))
  );

DROP POLICY IF EXISTS csc_write ON public.cash_session_counts;
CREATE POLICY csc_write ON public.cash_session_counts
  FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.can_write_org(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.can_write_org(organization_id));

-- RPC to close session with counts
CREATE OR REPLACE FUNCTION public.close_cash_session_with_counts(
  _session_id uuid,
  _counts jsonb   -- [{"denomination_id":"...","quantity":N}, ...]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session public.cash_sessions%ROWTYPE;
  v_item jsonb;
  v_denom_val numeric;
  v_qty int;
  v_total numeric := 0;
  v_diff numeric;
BEGIN
  SELECT * INTO v_session FROM public.cash_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.organization_id IS NULL OR NOT public.can_write_org(v_session.organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_session.status = 'closed' THEN RAISE EXCEPTION 'already_closed'; END IF;

  -- Clear previous close counts (idempotent)
  DELETE FROM public.cash_session_counts WHERE session_id = _session_id AND kind = 'close';

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(_counts,'[]'::jsonb)) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;
    SELECT value INTO v_denom_val FROM public.cash_denominations WHERE id = (v_item->>'denomination_id')::uuid;
    IF v_denom_val IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.cash_session_counts (session_id, denomination_id, quantity, kind, organization_id, created_by)
    VALUES (_session_id, (v_item->>'denomination_id')::uuid, v_qty, 'close', v_session.organization_id, auth.uid());
    v_total := v_total + (v_denom_val * v_qty);
  END LOOP;

  v_diff := v_total - COALESCE(v_session.expected_amount, 0);

  UPDATE public.cash_sessions
     SET closing_amount = v_total,
         difference = v_diff,
         status = 'closed',
         closed_at = now(),
         closed_by = auth.uid(),
         updated_at = now()
   WHERE id = _session_id;

  RETURN jsonb_build_object('closing_amount', v_total, 'expected_amount', v_session.expected_amount, 'difference', v_diff);
END $$;

REVOKE EXECUTE ON FUNCTION public.close_cash_session_with_counts(uuid, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.close_cash_session_with_counts(uuid, jsonb) TO authenticated;

-- =========================================================
-- 5) Trigger: orders.status -> 'confirmed' enqueues WhatsApp
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_on_confirmed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE')
     AND COALESCE(OLD.status,'') <> 'confirmed'
     AND NEW.status = 'confirmed' THEN
    INSERT INTO public.sync_outbox (target, payload, organization_id, next_attempt_at)
    VALUES (
      'whatsapp_order_confirmed',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'customer_phone', NEW.customer_phone),
      NEW.organization_id,
      now()
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_whatsapp_on_confirmed ON public.orders;
CREATE TRIGGER trg_orders_whatsapp_on_confirmed
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_on_confirmed();
