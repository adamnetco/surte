
-- Ola 12 — Slice 2: Auto-posting de ventas POS, pagos y compras

-- Helper: encontrar id de cuenta por código y org
CREATE OR REPLACE FUNCTION public.find_account_id(_org uuid, _code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounting_accounts
  WHERE organization_id = _org AND code = _code
  LIMIT 1
$$;

-- Auto-post de venta POS al marcarse como pagada
CREATE OR REPLACE FUNCTION public.autopost_pos_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_ar uuid;
  v_rev uuid;
  v_tax uuid;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.total,0) <= 0 THEN RETURN NEW; END IF;

  v_ar  := public.find_account_id(NEW.organization_id, '1305');
  v_rev := public.find_account_id(NEW.organization_id, '4135');
  v_tax := public.find_account_id(NEW.organization_id, '2408');

  IF v_ar IS NULL OR v_rev IS NULL THEN RETURN NEW; END IF;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_ar, 'debit', NEW.total, 'credit', 0, 'narration', 'Venta POS #'||NEW.ticket_number),
    jsonb_build_object('account_id', v_rev, 'debit', 0, 'credit', NEW.subtotal - COALESCE(NEW.discount,0), 'narration', 'Ingreso venta')
  );

  IF COALESCE(NEW.tax,0) > 0 AND v_tax IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_tax, 'debit', 0, 'credit', NEW.tax, 'narration', 'IVA generado')
    );
  END IF;

  BEGIN
    SELECT public.post_journal_entry(
      NEW.organization_id,
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'pos_order',
      NEW.id,
      'Venta POS #'||NEW.ticket_number,
      v_lines
    ) INTO v_entry_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'autopost_pos_order failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopost_pos_order ON public.pos_orders;
CREATE TRIGGER trg_autopost_pos_order
AFTER INSERT OR UPDATE OF status ON public.pos_orders
FOR EACH ROW EXECUTE FUNCTION public.autopost_pos_order();

-- Auto-post de pago: DR Caja/Bancos, CR AR
CREATE OR REPLACE FUNCTION public.autopost_pos_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash uuid;
  v_ar uuid;
  v_code text;
BEGIN
  IF COALESCE(NEW.amount,0) <= 0 THEN RETURN NEW; END IF;

  v_code := CASE WHEN lower(coalesce(NEW.method,'')) IN ('cash','efectivo') THEN '1105' ELSE '1110' END;
  v_cash := public.find_account_id(NEW.organization_id, v_code);
  v_ar   := public.find_account_id(NEW.organization_id, '1305');

  IF v_cash IS NULL OR v_ar IS NULL THEN RETURN NEW; END IF;

  BEGIN
    PERFORM public.post_journal_entry(
      NEW.organization_id,
      CURRENT_DATE,
      'pos_payment',
      NEW.id,
      'Pago '||COALESCE(NEW.method,'')||' #'||NEW.pos_order_id,
      jsonb_build_array(
        jsonb_build_object('account_id', v_cash, 'debit', NEW.amount, 'credit', 0, 'narration', 'Cobro'),
        jsonb_build_object('account_id', v_ar,   'debit', 0, 'credit', NEW.amount, 'narration', 'Cancela CxC')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'autopost_pos_payment failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopost_pos_payment ON public.pos_payments;
CREATE TRIGGER trg_autopost_pos_payment
AFTER INSERT ON public.pos_payments
FOR EACH ROW EXECUTE FUNCTION public.autopost_pos_payment();

-- Auto-post compra recibida: DR Inventario + IVA descontable, CR Proveedores
CREATE OR REPLACE FUNCTION public.autopost_purchase_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv uuid;
  v_iva uuid;
  v_ap uuid;
  v_lines jsonb;
BEGIN
  IF NEW.status <> 'received' OR (TG_OP='UPDATE' AND OLD.status='received') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total,0) <= 0 THEN RETURN NEW; END IF;

  v_inv := public.find_account_id(NEW.organization_id, '1435');
  v_iva := public.find_account_id(NEW.organization_id, '1355');
  v_ap  := public.find_account_id(NEW.organization_id, '2205');
  IF v_inv IS NULL OR v_ap IS NULL THEN RETURN NEW; END IF;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_inv, 'debit', NEW.subtotal, 'credit', 0, 'narration', 'Compra '||COALESCE(NEW.po_code, NEW.po_number::text)),
    jsonb_build_object('account_id', v_ap,  'debit', 0, 'credit', NEW.total, 'narration', 'Proveedor')
  );
  IF COALESCE(NEW.tax,0) > 0 AND v_iva IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_iva, 'debit', NEW.tax, 'credit', 0, 'narration', 'IVA descontable')
    );
  END IF;

  BEGIN
    PERFORM public.post_journal_entry(
      NEW.organization_id,
      COALESCE(NEW.received_at::date, CURRENT_DATE),
      'purchase_order',
      NEW.id,
      'Compra '||COALESCE(NEW.po_code, NEW.po_number::text),
      v_lines
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'autopost_purchase_order failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopost_purchase_order ON public.purchase_orders;
CREATE TRIGGER trg_autopost_purchase_order
AFTER INSERT OR UPDATE OF status ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.autopost_purchase_order();
