CREATE OR REPLACE FUNCTION public.fx_customer_monthly_accumulated(
  p_organization_id uuid,
  p_doc_number text,
  p_month_start date DEFAULT (date_trunc('month', now()))::date
)
RETURNS TABLE (accumulated numeric, currency text, tx_count integer, exceeds boolean)
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
BEGIN
  IF p_doc_number IS NULL OR length(btrim(p_doc_number)) < 3 THEN
    RETURN QUERY SELECT 0::numeric, 'USD'::text, 0::integer, false;
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

  SELECT
    COALESCE(SUM(
      CASE
        WHEN fc_from.code = v_threshold_currency THEN t.from_amount
        WHEN fc_to.code   = v_threshold_currency THEN t.to_amount
        ELSE 0
      END
    ), 0),
    COUNT(*)::int
  INTO v_acc, v_count
  FROM public.fx_transactions t
  LEFT JOIN public.fx_currencies fc_from ON fc_from.id = t.from_currency_id
  LEFT JOIN public.fx_currencies fc_to   ON fc_to.id   = t.to_currency_id
  WHERE t.organization_id = p_organization_id
    AND t.customer_doc_number = btrim(p_doc_number)
    AND t.created_at >= p_month_start
    AND t.created_at <  (p_month_start + interval '1 month');

  RETURN QUERY SELECT v_acc, v_threshold_currency, v_count, (v_acc >= v_threshold_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fx_customer_monthly_accumulated(uuid, text, date) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_fx_tx_org_doc_created
  ON public.fx_transactions (organization_id, customer_doc_number, created_at DESC)
  WHERE customer_doc_number IS NOT NULL;