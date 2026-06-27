
-- Ola 13 Slice 1: Auto-reversal contable al aceptar Nota Crédito DIAN
-- Cuando un electronic_invoice de tipo credit_note pasa a status='accepted',
-- buscamos el journal_entry de la factura origen y lo revertimos.
-- Las notas débito NO se revierten: posteamos un nuevo cargo (AR+Rev) por el delta.

CREATE OR REPLACE FUNCTION public.autopost_einvoice_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig_invoice  public.electronic_invoices%ROWTYPE;
  v_orig_ref_type text;
  v_orig_ref_id   uuid;
  v_orig_entry_id uuid;
  v_existing_rev  uuid;
  v_ar  uuid;
  v_rev uuid;
  v_tax uuid;
  v_lines jsonb;
  v_new_entry uuid;
BEGIN
  -- Solo nos interesan transiciones a 'accepted' en NC/ND
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' THEN RETURN NEW; END IF;
  IF NEW.document_type NOT IN ('credit_note','debit_note') THEN RETURN NEW; END IF;
  IF NEW.reference_invoice_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_orig_invoice
  FROM public.electronic_invoices
  WHERE id = NEW.reference_invoice_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Resolver reference_type/id del asiento original
  IF v_orig_invoice.pos_order_id IS NOT NULL THEN
    v_orig_ref_type := 'pos_order';
    v_orig_ref_id   := v_orig_invoice.pos_order_id;
  ELSIF v_orig_invoice.order_id IS NOT NULL THEN
    v_orig_ref_type := 'order';
    v_orig_ref_id   := v_orig_invoice.order_id;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.document_type = 'credit_note' THEN
    -- Buscar el journal_entry original (POSTED, no reversal)
    SELECT id INTO v_orig_entry_id
    FROM public.journal_entries
    WHERE organization_id = NEW.organization_id
      AND reference_type  = v_orig_ref_type
      AND reference_id    = v_orig_ref_id
      AND status = 'posted'
      AND is_reversal = false
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_orig_entry_id IS NULL THEN
      RAISE WARNING 'autopost_einvoice_note: original JE not found for invoice %', v_orig_invoice.id;
      RETURN NEW;
    END IF;

    -- Idempotencia: ¿ya existe reversal para ese asiento?
    SELECT id INTO v_existing_rev
    FROM public.journal_entries
    WHERE reversed_entry_id = v_orig_entry_id
    LIMIT 1;

    IF v_existing_rev IS NOT NULL THEN RETURN NEW; END IF;

    BEGIN
      PERFORM public.reverse_journal_entry(
        v_orig_entry_id,
        COALESCE(NEW.issue_date::date, CURRENT_DATE),
        'NC '||COALESCE(NEW.full_number, NEW.id::text)||' sobre '||COALESCE(v_orig_invoice.full_number,'—')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'autopost_einvoice_note reverse failed: %', SQLERRM;
    END;

  ELSIF NEW.document_type = 'debit_note' THEN
    -- ND = cargo adicional. Posteamos DR AR / CR Revenue (+ IVA si aplica)
    IF COALESCE(NEW.total,0) <= 0 THEN RETURN NEW; END IF;

    v_ar  := public.find_account_id(NEW.organization_id, '1305');
    v_rev := public.find_account_id(NEW.organization_id, '4135');
    v_tax := public.find_account_id(NEW.organization_id, '2408');
    IF v_ar IS NULL OR v_rev IS NULL THEN RETURN NEW; END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_ar,  'debit', NEW.total,    'credit', 0, 'narration', 'ND '||COALESCE(NEW.full_number,'')),
      jsonb_build_object('account_id', v_rev, 'debit', 0, 'credit', NEW.subtotal, 'narration', 'Cargo adicional')
    );
    IF COALESCE(NEW.tax_total,0) > 0 AND v_tax IS NOT NULL THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_id', v_tax, 'debit', 0, 'credit', NEW.tax_total, 'narration', 'IVA ND')
      );
    END IF;

    BEGIN
      SELECT public.post_journal_entry(
        NEW.organization_id,
        COALESCE(NEW.issue_date::date, CURRENT_DATE),
        'einvoice_debit_note',
        NEW.id,
        'Nota Débito '||COALESCE(NEW.full_number, NEW.id::text),
        v_lines
      ) INTO v_new_entry;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'autopost_einvoice_note ND post failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopost_einvoice_note ON public.electronic_invoices;
CREATE TRIGGER trg_autopost_einvoice_note
AFTER INSERT OR UPDATE OF status ON public.electronic_invoices
FOR EACH ROW EXECUTE FUNCTION public.autopost_einvoice_note();
