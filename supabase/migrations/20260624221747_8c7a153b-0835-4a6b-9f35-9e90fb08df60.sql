
CREATE OR REPLACE FUNCTION public.fx_convert_to_currency(
  p_organization_id uuid,
  p_amount numeric,
  p_from_currency_id uuid,
  p_to_currency_code text,
  p_at timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_code text;
  v_to_id uuid;
  v_rate numeric;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RETURN 0;
  END IF;

  SELECT code INTO v_from_code
    FROM public.fx_currencies
   WHERE id = p_from_currency_id
     AND organization_id = p_organization_id;
  IF v_from_code IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_from_code = p_to_currency_code THEN
    RETURN p_amount;
  END IF;

  SELECT id INTO v_to_id
    FROM public.fx_currencies
   WHERE organization_id = p_organization_id
     AND code = p_to_currency_code
   LIMIT 1;
  IF v_to_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Direct pair: base=from, quote=to → multiply
  SELECT COALESCE(r.base_rate, (r.buy_rate + r.sell_rate) / NULLIF(2, 0))
    INTO v_rate
    FROM public.fx_rates r
    JOIN public.fx_pairs p ON p.id = r.pair_id
   WHERE r.organization_id = p_organization_id
     AND r.is_published = true
     AND r.effective_at <= p_at
     AND p.base_currency_id = p_from_currency_id
     AND p.quote_currency_id = v_to_id
   ORDER BY r.effective_at DESC
   LIMIT 1;
  IF v_rate IS NOT NULL AND v_rate > 0 THEN
    RETURN p_amount * v_rate;
  END IF;

  -- Inverse pair: base=to, quote=from → divide
  SELECT COALESCE(r.base_rate, (r.buy_rate + r.sell_rate) / NULLIF(2, 0))
    INTO v_rate
    FROM public.fx_rates r
    JOIN public.fx_pairs p ON p.id = r.pair_id
   WHERE r.organization_id = p_organization_id
     AND r.is_published = true
     AND r.effective_at <= p_at
     AND p.base_currency_id = v_to_id
     AND p.quote_currency_id = p_from_currency_id
   ORDER BY r.effective_at DESC
   LIMIT 1;
  IF v_rate IS NOT NULL AND v_rate > 0 THEN
    RETURN p_amount / v_rate;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fx_convert_to_currency(uuid, numeric, uuid, text, timestamptz) TO authenticated;

-- Recreate fx_customer_monthly_accumulated with cross-rate + extended return shape.
DROP FUNCTION IF EXISTS public.fx_customer_monthly_accumulated(uuid, text, date);

CREATE OR REPLACE FUNCTION public.fx_customer_monthly_accumulated(
  p_organization_id uuid,
  p_doc_number text,
  p_month_start date DEFAULT (date_trunc('month', now()))::date
)
RETURNS TABLE (
  accumulated numeric,
  currency text,
  tx_count integer,
  exceeds boolean,
  cross_count integer,
  missing_rate_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold_amount numeric;
  v_threshold_currency text;
  v_acc numeric := 0;
  v_count integer := 0;
  v_cross integer := 0;
  v_missing integer := 0;
BEGIN
  IF p_doc_number IS NULL OR length(btrim(p_doc_number)) < 3 THEN
    RETURN QUERY SELECT 0::numeric, 'USD'::text, 0::integer, false, 0::integer, 0::integer;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(o.uiaf_threshold_amount, 10000),
         COALESCE(o.uiaf_threshold_currency, 'USD')
    INTO v_threshold_amount, v_threshold_currency
    FROM public.organizations o
   WHERE o.id = p_organization_id;

  WITH txs AS (
    SELECT t.*, fc_from.code AS from_code, fc_to.code AS to_code
      FROM public.fx_transactions t
      LEFT JOIN public.fx_currencies fc_from ON fc_from.id = t.from_currency_id
      LEFT JOIN public.fx_currencies fc_to   ON fc_to.id   = t.to_currency_id
     WHERE t.organization_id = p_organization_id
       AND t.customer_doc_number = btrim(p_doc_number)
       AND t.created_at >= p_month_start
       AND t.created_at <  (p_month_start + interval '1 month')
  ), valued AS (
    SELECT
      t.*,
      CASE
        WHEN t.from_code = v_threshold_currency THEN t.from_amount
        WHEN t.to_code   = v_threshold_currency THEN t.to_amount
        ELSE public.fx_convert_to_currency(
          p_organization_id, t.from_amount, t.from_currency_id, v_threshold_currency, t.created_at
        )
      END AS amount_in_threshold,
      CASE
        WHEN t.from_code = v_threshold_currency OR t.to_code = v_threshold_currency THEN false
        ELSE true
      END AS is_cross
    FROM txs t
  )
  SELECT
    COALESCE(SUM(COALESCE(amount_in_threshold, 0)), 0),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE is_cross AND amount_in_threshold IS NOT NULL)::int,
    COUNT(*) FILTER (WHERE is_cross AND amount_in_threshold IS NULL)::int
  INTO v_acc, v_count, v_cross, v_missing
  FROM valued;

  RETURN QUERY SELECT
    v_acc,
    v_threshold_currency,
    v_count,
    (v_acc >= v_threshold_amount),
    v_cross,
    v_missing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fx_customer_monthly_accumulated(uuid, text, date) TO authenticated;
