
-- Trial balance: saldo por cuenta entre fechas
CREATE OR REPLACE FUNCTION public.report_trial_balance(
  _org uuid, _from date, _to date
) RETURNS TABLE(
  account_id uuid, code text, name text, type text, nature text,
  debit_total numeric, credit_total numeric, balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.code, a.name, a.type::text, a.nature::text,
    COALESCE(SUM(l.debit_amount),0) AS debit_total,
    COALESCE(SUM(l.credit_amount),0) AS credit_total,
    CASE WHEN a.nature = 'debit'
      THEN COALESCE(SUM(l.debit_amount),0) - COALESCE(SUM(l.credit_amount),0)
      ELSE COALESCE(SUM(l.credit_amount),0) - COALESCE(SUM(l.debit_amount),0)
    END AS balance
  FROM public.accounting_accounts a
  LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
  LEFT JOIN public.journal_entries e ON e.id = l.journal_entry_id
    AND e.status = 'posted'
    AND e.entry_date BETWEEN _from AND _to
  WHERE a.organization_id = _org
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  GROUP BY a.id, a.code, a.name, a.type, a.nature
  ORDER BY a.code;
$$;

REVOKE EXECUTE ON FUNCTION public.report_trial_balance(uuid,date,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_trial_balance(uuid,date,date) TO authenticated;

-- Income Statement (P&L)
CREATE OR REPLACE FUNCTION public.report_income_statement(
  _org uuid, _from date, _to date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rev numeric:=0; v_cogs numeric:=0; v_exp numeric:=0;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN a.type='revenue' THEN l.credit_amount - l.debit_amount ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN a.type='cogs'    THEN l.debit_amount - l.credit_amount ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN a.type='expense' THEN l.debit_amount - l.credit_amount ELSE 0 END),0)
  INTO v_rev, v_cogs, v_exp
  FROM public.journal_entry_lines l
  JOIN public.accounting_accounts a ON a.id = l.account_id
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE a.organization_id = _org AND e.status='posted'
    AND e.entry_date BETWEEN _from AND _to;

  RETURN jsonb_build_object(
    'revenue', v_rev, 'cogs', v_cogs, 'gross_profit', v_rev - v_cogs,
    'expenses', v_exp, 'net_income', v_rev - v_cogs - v_exp,
    'from', _from, 'to', _to
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_income_statement(uuid,date,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_income_statement(uuid,date,date) TO authenticated;

-- Balance Sheet a fecha de corte
CREATE OR REPLACE FUNCTION public.report_balance_sheet(
  _org uuid, _as_of date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_assets numeric:=0; v_liab numeric:=0; v_equity numeric:=0; v_ni numeric:=0;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN a.type='asset'     THEN l.debit_amount - l.credit_amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN a.type='liability' THEN l.credit_amount - l.debit_amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN a.type='equity'    THEN l.credit_amount - l.debit_amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN a.type='revenue'   THEN l.credit_amount - l.debit_amount
                      WHEN a.type IN ('cogs','expense') THEN -(l.debit_amount - l.credit_amount)
                      ELSE 0 END),0)
  INTO v_assets, v_liab, v_equity, v_ni
  FROM public.journal_entry_lines l
  JOIN public.accounting_accounts a ON a.id = l.account_id
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE a.organization_id = _org AND e.status='posted'
    AND e.entry_date <= _as_of;

  RETURN jsonb_build_object(
    'assets', v_assets, 'liabilities', v_liab, 'equity', v_equity,
    'net_income', v_ni, 'total_equity_plus_ni', v_equity + v_ni,
    'balanced', round(v_assets - (v_liab + v_equity + v_ni), 2) = 0,
    'as_of', _as_of
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_balance_sheet(uuid,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_balance_sheet(uuid,date) TO authenticated;
