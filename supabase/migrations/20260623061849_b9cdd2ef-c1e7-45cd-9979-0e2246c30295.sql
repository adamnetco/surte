
-- Phase 3: Lifecycle runtime guard
-- Blocks new mutations on critical tables when org lifecycle_state is past_due/suspended/archived.
-- Superadmin bypasses for support operations.

CREATE OR REPLACE FUNCTION public.assert_org_writable(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text;
BEGIN
  IF _org_id IS NULL THEN
    RETURN;
  END IF;

  -- Superadmin bypass (support actions)
  IF public.is_master_superadmin(auth.uid())
     OR public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN;
  END IF;

  SELECT lifecycle_state::text INTO v_state
  FROM public.organizations
  WHERE id = _org_id;

  IF v_state IS NULL THEN
    RETURN;
  END IF;

  IF v_state IN ('suspended','archived') THEN
    RAISE EXCEPTION 'org_suspended: organization is % - new operations are blocked. Contact support.', v_state
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_state = 'past_due' THEN
    RAISE EXCEPTION 'org_past_due: organization has overdue payment - new operations are blocked until payment is updated.'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_org_writable(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_block_writes_if_suspended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_org_writable(NEW.organization_id);
  RETURN NEW;
END;
$$;

-- Attach BEFORE INSERT triggers to critical write paths.
-- Use DROP IF EXISTS for idempotency.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'pos_orders',
    'pos_payments',
    'electronic_invoices',
    'table_orders',
    'purchase_orders',
    'stock_movements',
    'cash_sessions',
    'orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_writes_if_suspended ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_writes_if_suspended
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.tg_block_writes_if_suspended()',
      t
    );
  END LOOP;
END $$;
