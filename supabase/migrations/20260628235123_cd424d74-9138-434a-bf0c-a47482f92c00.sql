
-- Ola 23 Slice 2: triggers que encolan eventos automáticos a webhooks.

-- 1. Helper: emite evento solo si la org tiene endpoints activos suscritos
CREATE OR REPLACE FUNCTION public.emit_webhook_if_subscribed(p_org uuid, p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.webhook_endpoints
    WHERE organization_id = p_org
      AND is_active = true
      AND p_event = ANY(events)
  ) INTO v_has;
  IF v_has THEN
    PERFORM public.enqueue_webhook_event(p_org, p_event, p_payload);
  END IF;
END;
$$;

-- 2. POS orders: created / paid / voided
CREATE OR REPLACE FUNCTION public.trg_pos_order_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_event text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'pos_order.created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'paid' THEN v_event := 'pos_order.paid';
      ELSIF NEW.status = 'voided' THEN v_event := 'pos_order.voided';
      ELSE RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  v_payload := jsonb_build_object(
    'id', NEW.id, 'organization_id', NEW.organization_id, 'location_id', NEW.location_id,
    'ticket_number', NEW.ticket_number, 'total', NEW.total, 'status', NEW.status,
    'customer_name', NEW.customer_name, 'customer_document', NEW.customer_document,
    'paid_at', NEW.paid_at, 'created_at', NEW.created_at
  );
  PERFORM public.emit_webhook_if_subscribed(NEW.organization_id, v_event, v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_order_webhook ON public.pos_orders;
CREATE TRIGGER trg_pos_order_webhook
AFTER INSERT OR UPDATE OF status ON public.pos_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_order_webhook();

-- 3. Electronic invoices: accepted / rejected
CREATE OR REPLACE FUNCTION public.trg_einvoice_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_event text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status = 'accepted' THEN v_event := 'einvoice.accepted';
  ELSIF NEW.status = 'rejected' THEN v_event := 'einvoice.rejected';
  ELSE RETURN NEW;
  END IF;
  PERFORM public.emit_webhook_if_subscribed(NEW.organization_id, v_event, jsonb_build_object(
    'id', NEW.id, 'organization_id', NEW.organization_id, 'document_type', NEW.document_type,
    'full_number', NEW.full_number, 'cufe', NEW.cufe, 'total', NEW.total,
    'customer_identification', NEW.customer_identification, 'customer_name', NEW.customer_name,
    'qr_url', NEW.qr_url, 'pdf_url', NEW.pdf_url, 'xml_url', NEW.xml_url,
    'status', NEW.status, 'issue_date', NEW.issue_date
  ));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_einvoice_webhook ON public.electronic_invoices;
CREATE TRIGGER trg_einvoice_webhook
AFTER UPDATE OF status ON public.electronic_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_einvoice_webhook();

-- 4. Stock low: cuando quantity cruza por debajo del reorder_point
CREATE OR REPLACE FUNCTION public.trg_stock_low_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.reorder_point IS NULL OR NEW.reorder_point = 0 THEN RETURN NEW; END IF;
  IF NEW.quantity <= NEW.reorder_point AND (OLD.quantity > OLD.reorder_point OR OLD.quantity > NEW.reorder_point) THEN
    PERFORM public.emit_webhook_if_subscribed(NEW.organization_id, 'stock.low', jsonb_build_object(
      'product_id', NEW.product_id, 'presentation_id', NEW.presentation_id,
      'warehouse_id', NEW.warehouse_id, 'quantity', NEW.quantity, 'reorder_point', NEW.reorder_point,
      'min_stock', NEW.min_stock
    ));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stock_low_webhook ON public.product_stock;
CREATE TRIGGER trg_stock_low_webhook
AFTER UPDATE OF quantity ON public.product_stock
FOR EACH ROW EXECUTE FUNCTION public.trg_stock_low_webhook();

GRANT EXECUTE ON FUNCTION public.emit_webhook_if_subscribed(uuid, text, jsonb) TO authenticated, service_role;
