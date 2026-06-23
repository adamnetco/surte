
-- =============================================================
-- Slice 4 FX: caja multi-divisa
-- =============================================================

-- 1) cash_sessions.balances: saldos por divisa (JSONB)
-- Estructura: {"COP": {"opening": 100000, "expected": 250000, "counted": null, "diff": null}, "USD": {...}}
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS balances JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.cash_sessions.balances IS
  'Saldos multi-divisa para casas de cambio. Clave = código ISO 4217 (USD/EUR/COP...). Cada valor: {opening, expected, counted, diff}.';

-- 2) cash_session_counts.currency: cada conteo es de una divisa
ALTER TABLE public.cash_session_counts
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'COP';

CREATE INDEX IF NOT EXISTS idx_cash_session_counts_currency
  ON public.cash_session_counts(session_id, currency);

-- 3) Helper: aplicar delta a saldo expected de una divisa en la sesión
CREATE OR REPLACE FUNCTION public.fx_apply_session_balance(
  _session_id UUID,
  _currency_code TEXT,
  _delta NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
  v_opening NUMERIC;
BEGIN
  IF _session_id IS NULL OR _currency_code IS NULL THEN RETURN; END IF;

  -- Asegura la key con estructura base si no existe
  UPDATE public.cash_sessions
  SET balances = COALESCE(balances, '{}'::jsonb)
                 || jsonb_build_object(
                      _currency_code,
                      COALESCE(balances->_currency_code,
                               jsonb_build_object('opening', 0, 'expected', 0, 'counted', NULL, 'diff', NULL))
                    )
  WHERE id = _session_id;

  -- Aplica delta sobre expected
  v_current := COALESCE(
    (SELECT (balances->_currency_code->>'expected')::numeric FROM public.cash_sessions WHERE id = _session_id),
    0
  );
  v_opening := COALESCE(
    (SELECT (balances->_currency_code->>'opening')::numeric FROM public.cash_sessions WHERE id = _session_id),
    0
  );

  UPDATE public.cash_sessions
  SET balances = jsonb_set(
        balances,
        ARRAY[_currency_code, 'expected'],
        to_jsonb(v_current + _delta),
        true
      ),
      updated_at = now()
  WHERE id = _session_id;
END;
$$;

-- 4) Trigger sobre fx_transactions → ajusta saldos de la sesión
CREATE OR REPLACE FUNCTION public.fx_transactions_update_session_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_code TEXT;
  v_to_code TEXT;
BEGIN
  IF NEW.cash_session_id IS NULL THEN RETURN NEW; END IF;

  SELECT code INTO v_from_code FROM public.fx_currencies WHERE id = NEW.from_currency_id;
  SELECT code INTO v_to_code FROM public.fx_currencies WHERE id = NEW.to_currency_id;

  -- La casa RECIBE from_amount en from_currency y ENTREGA to_amount en to_currency
  PERFORM public.fx_apply_session_balance(NEW.cash_session_id, v_from_code, NEW.from_amount);
  PERFORM public.fx_apply_session_balance(NEW.cash_session_id, v_to_code, -NEW.to_amount);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_transactions_update_session_balances ON public.fx_transactions;
CREATE TRIGGER trg_fx_transactions_update_session_balances
  AFTER INSERT ON public.fx_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fx_transactions_update_session_balances();

-- 5) Cierre multi-divisa: registra conteos por divisa y calcula diff por divisa
CREATE OR REPLACE FUNCTION public.close_cash_session_multi_currency(
  _session_id UUID,
  _counts JSONB,           -- [{denomination_id, currency, quantity}]
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_user UUID := auth.uid();
  v_item JSONB;
  v_counted_by_currency JSONB := '{}'::jsonb;
  v_balances JSONB;
  v_key TEXT;
  v_expected NUMERIC;
  v_counted NUMERIC;
  v_diff NUMERIC;
BEGIN
  SELECT organization_id, balances INTO v_org, v_balances
  FROM public.cash_sessions WHERE id = _session_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'cash_session not found';
  END IF;

  -- Insertar conteos (con currency)
  IF _counts IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(_counts)
    LOOP
      IF COALESCE((v_item->>'quantity')::int, 0) > 0 THEN
        INSERT INTO public.cash_session_counts (
          session_id, denomination_id, quantity, kind, currency, organization_id, created_by
        )
        SELECT
          _session_id,
          (v_item->>'denomination_id')::uuid,
          (v_item->>'quantity')::int,
          d.kind,
          COALESCE(v_item->>'currency', d.currency, 'COP'),
          v_org,
          v_user
        FROM public.cash_denominations d
        WHERE d.id = (v_item->>'denomination_id')::uuid;
      END IF;
    END LOOP;
  END IF;

  -- Recalcular counted por divisa
  SELECT jsonb_object_agg(currency, total)
  INTO v_counted_by_currency
  FROM (
    SELECT csc.currency, SUM(csc.quantity * d.value)::numeric AS total
    FROM public.cash_session_counts csc
    JOIN public.cash_denominations d ON d.id = csc.denomination_id
    WHERE csc.session_id = _session_id
    GROUP BY csc.currency
  ) t;

  v_counted_by_currency := COALESCE(v_counted_by_currency, '{}'::jsonb);

  -- Actualizar balances JSONB con counted + diff por divisa
  FOR v_key IN SELECT jsonb_object_keys(COALESCE(v_balances, '{}'::jsonb))
  LOOP
    v_expected := COALESCE((v_balances->v_key->>'expected')::numeric, 0);
    v_counted  := COALESCE((v_counted_by_currency->>v_key)::numeric, 0);
    v_diff     := v_counted - v_expected;

    v_balances := jsonb_set(v_balances, ARRAY[v_key, 'counted'], to_jsonb(v_counted), true);
    v_balances := jsonb_set(v_balances, ARRAY[v_key, 'diff'],    to_jsonb(v_diff), true);
  END LOOP;

  -- También cubrir divisas contadas pero sin entry previa
  FOR v_key IN SELECT jsonb_object_keys(v_counted_by_currency)
  LOOP
    IF v_balances ? v_key THEN CONTINUE; END IF;
    v_counted := COALESCE((v_counted_by_currency->>v_key)::numeric, 0);
    v_balances := v_balances || jsonb_build_object(
      v_key, jsonb_build_object('opening', 0, 'expected', 0, 'counted', v_counted, 'diff', v_counted)
    );
  END LOOP;

  UPDATE public.cash_sessions
  SET status = 'closed',
      closed_at = now(),
      closed_by = v_user,
      balances = v_balances,
      notes = COALESCE(_notes, notes),
      updated_at = now()
  WHERE id = _session_id;

  RETURN v_balances;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fx_apply_session_balance(UUID, TEXT, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_session_multi_currency(UUID, JSONB, TEXT) TO authenticated, service_role;
