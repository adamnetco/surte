
-- Fix slice 2: argument order for post_journal_entry
CREATE OR REPLACE FUNCTION public.autopost_pos_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ar uuid; v_rev uuid; v_tax uuid; v_lines jsonb;
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP='UPDATE' AND OLD.status='paid') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total,0) <= 0 THEN RETURN NEW; END IF;
  v_ar  := public.find_account_id(NEW.organization_id, '1305');
  v_rev := public.find_account_id(NEW.organization_id, '4135');
  v_tax := public.find_account_id(NEW.organization_id, '2408');
  IF v_ar IS NULL OR v_rev IS NULL THEN RETURN NEW; END IF;
  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_ar, 'debit', NEW.total, 'credit', 0),
    jsonb_build_object('account_id', v_rev, 'debit', 0, 'credit', NEW.subtotal - COALESCE(NEW.discount,0))
  );
  IF COALESCE(NEW.tax,0) > 0 AND v_tax IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_tax, 'debit', 0, 'credit', NEW.tax));
  END IF;
  BEGIN
    PERFORM public.post_journal_entry(
      NEW.organization_id, COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'Venta POS #'||NEW.ticket_number, 'pos_order', NEW.id, v_lines);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'autopost_pos_order: %', SQLERRM; END;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.autopost_pos_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cash uuid; v_ar uuid; v_code text;
BEGIN
  IF COALESCE(NEW.amount,0) <= 0 THEN RETURN NEW; END IF;
  v_code := CASE WHEN lower(coalesce(NEW.method,'')) IN ('cash','efectivo') THEN '1105' ELSE '1110' END;
  v_cash := public.find_account_id(NEW.organization_id, v_code);
  v_ar   := public.find_account_id(NEW.organization_id, '1305');
  IF v_cash IS NULL OR v_ar IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public.post_journal_entry(
      NEW.organization_id, CURRENT_DATE,
      'Pago '||COALESCE(NEW.method,''), 'pos_payment', NEW.id,
      jsonb_build_array(
        jsonb_build_object('account_id', v_cash, 'debit', NEW.amount, 'credit', 0),
        jsonb_build_object('account_id', v_ar,   'debit', 0, 'credit', NEW.amount)));
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'autopost_pos_payment: %', SQLERRM; END;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.autopost_purchase_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid; v_iva uuid; v_ap uuid; v_lines jsonb;
BEGIN
  IF NEW.status <> 'received' OR (TG_OP='UPDATE' AND OLD.status='received') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total,0) <= 0 THEN RETURN NEW; END IF;
  v_inv := public.find_account_id(NEW.organization_id, '1435');
  v_iva := public.find_account_id(NEW.organization_id, '1355');
  v_ap  := public.find_account_id(NEW.organization_id, '2205');
  IF v_inv IS NULL OR v_ap IS NULL THEN RETURN NEW; END IF;
  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_inv, 'debit', NEW.subtotal, 'credit', 0),
    jsonb_build_object('account_id', v_ap,  'debit', 0, 'credit', NEW.total));
  IF COALESCE(NEW.tax,0) > 0 AND v_iva IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_iva, 'debit', NEW.tax, 'credit', 0));
  END IF;
  BEGIN
    PERFORM public.post_journal_entry(
      NEW.organization_id, COALESCE(NEW.received_at::date, CURRENT_DATE),
      'Compra '||COALESCE(NEW.po_code, NEW.po_number::text), 'purchase_order', NEW.id, v_lines);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'autopost_purchase_order: %', SQLERRM; END;
  RETURN NEW;
END; $$;

-- ============ Period management ============

CREATE OR REPLACE FUNCTION public.open_fiscal_period(
  _org uuid, _name text, _start date, _end date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _end < _start THEN RAISE EXCEPTION 'end_date must be >= start_date'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.fiscal_periods
    WHERE organization_id = _org
      AND tstzrange(start_date, end_date, '[]') && tstzrange(_start, _end, '[]')
  ) THEN
    RAISE EXCEPTION 'overlapping period exists';
  END IF;
  INSERT INTO public.fiscal_periods (organization_id, name, start_date, end_date, status)
  VALUES (_org, _name, _start, _end, 'open') RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.close_fiscal_period(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.fiscal_periods SET status='closed', closed_at=now(), closed_by=auth.uid()
  WHERE id = _id;
END; $$;

CREATE OR REPLACE FUNCTION public.reopen_fiscal_period(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN
    RAISE EXCEPTION 'only superadmin can reopen periods';
  END IF;
  UPDATE public.fiscal_periods SET status='open', closed_at=NULL, closed_by=NULL WHERE id = _id;
END; $$;

-- Year-end closing: transfer P&L accounts to Retained Earnings (3605 in our seeded PUC; fallback to first equity account)
CREATE OR REPLACE FUNCTION public.close_fiscal_year(_org uuid, _year int)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := make_date(_year,1,1);
  v_to   date := make_date(_year,12,31);
  v_re   uuid;
  v_rev numeric:=0; v_cogs numeric:=0; v_exp numeric:=0; v_ni numeric:=0;
  v_lines jsonb := '[]'::jsonb;
  v_entry uuid;
  r RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_re := public.find_account_id(_org, '3605');
  IF v_re IS NULL THEN
    SELECT id INTO v_re FROM public.accounting_accounts
    WHERE organization_id=_org AND type='equity' ORDER BY code LIMIT 1;
  END IF;
  IF v_re IS NULL THEN RAISE EXCEPTION 'No equity account found for retained earnings'; END IF;

  -- For each P&L account with a non-zero balance, create a closing line
  FOR r IN
    SELECT a.id, a.type::text AS type, a.nature::text AS nature,
      COALESCE(SUM(l.debit_amount),0) - COALESCE(SUM(l.credit_amount),0) AS net_debit
    FROM public.accounting_accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries e ON e.id = l.journal_entry_id
      AND e.status='posted' AND e.entry_date BETWEEN v_from AND v_to
    WHERE a.organization_id = _org AND a.type IN ('revenue','cogs','expense')
    GROUP BY a.id, a.type, a.nature
    HAVING (COALESCE(SUM(l.debit_amount),0) - COALESCE(SUM(l.credit_amount),0)) <> 0
  LOOP
    -- Closing reverses each account back to zero
    IF r.net_debit > 0 THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', r.id, 'debit', 0, 'credit', r.net_debit));
    ELSE
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', r.id, 'debit', -r.net_debit, 'credit', 0));
    END IF;
    IF r.type = 'revenue' THEN v_rev := v_rev + (-r.net_debit);
    ELSIF r.type = 'cogs' THEN v_cogs := v_cogs + r.net_debit;
    ELSE v_exp := v_exp + r.net_debit;
    END IF;
  END LOOP;

  v_ni := v_rev - v_cogs - v_exp;
  IF v_ni = 0 AND jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'No P&L movement in year %', _year;
  END IF;

  -- Balancing line: profit credits RE, loss debits RE
  IF v_ni >= 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_re, 'debit', 0, 'credit', v_ni));
  ELSE
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_re, 'debit', -v_ni, 'credit', 0));
  END IF;

  v_entry := public.post_journal_entry(_org, v_to,
    'Cierre de ejercicio '||_year, 'year_close', NULL, v_lines);
  RETURN v_entry;
END; $$;

REVOKE EXECUTE ON FUNCTION public.open_fiscal_period(uuid,text,date,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_fiscal_period(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reopen_fiscal_period(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_fiscal_year(uuid,int) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_fiscal_period(uuid,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_fiscal_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_fiscal_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_fiscal_year(uuid,int) TO authenticated;
