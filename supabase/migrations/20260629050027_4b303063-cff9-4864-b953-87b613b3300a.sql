
-- 1) Ampliar source_table permitido en fiscal_adjustment_log
ALTER TABLE public.fiscal_adjustment_log
  DROP CONSTRAINT IF EXISTS fiscal_adjustment_log_source_table_check;
ALTER TABLE public.fiscal_adjustment_log
  ADD CONSTRAINT fiscal_adjustment_log_source_table_check
  CHECK (source_table IN ('stock_movements','cash_movements','pos_void_log'));

-- 2) Tabla pos_void_log
CREATE TABLE IF NOT EXISTS public.pos_void_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  table_order_id       UUID REFERENCES public.table_orders(id) ON DELETE SET NULL,
  table_order_item_id  UUID,
  product_id           UUID,
  product_name         TEXT NOT NULL,
  quantity             NUMERIC(18,4) NOT NULL,
  amount               NUMERIC(18,4) NOT NULL,
  reason_code          TEXT NOT NULL,
  reason_text          TEXT NOT NULL,
  void_ticket_number   BIGINT NOT NULL,
  voided_by            UUID,
  voided_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, void_ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_pos_void_log_org_at
  ON public.pos_void_log (organization_id, voided_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_void_log_order
  ON public.pos_void_log (table_order_id);

GRANT SELECT ON public.pos_void_log TO authenticated;
GRANT ALL    ON public.pos_void_log TO service_role;

ALTER TABLE public.pos_void_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_void_log_read_admin_or_superadmin"
  ON public.pos_void_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = pos_void_log.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

-- Inmutabilidad: bloquear UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.pos_void_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pos_void_log es inmutable (append-only)';
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_void_log_no_update ON public.pos_void_log;
CREATE TRIGGER trg_pos_void_log_no_update
  BEFORE UPDATE OR DELETE ON public.pos_void_log
  FOR EACH ROW EXECUTE FUNCTION public.pos_void_log_immutable();

-- 3) RPC pos_void_table_item
CREATE OR REPLACE FUNCTION public.pos_void_table_item(
  _item_id      UUID,
  _reason_code  TEXT,
  _reason_text  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        RECORD;
  v_order       RECORD;
  v_org         UUID;
  v_user        UUID := auth.uid();
  v_ticket      BIGINT;
  v_void_id     UUID;
  v_seq         BIGINT;
  v_prev_hash   TEXT;
  v_canon       TEXT;
  v_hash        TEXT;
  v_payload     JSONB;
  v_allowed     CONSTANT TEXT[] := ARRAY['error_digitacion','agotado','cliente_cambio','mal_preparado','otro'];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _reason_code IS NULL OR NOT (_reason_code = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'reason_code invalido';
  END IF;
  IF _reason_text IS NULL OR length(btrim(_reason_text)) < 3 THEN
    RAISE EXCEPTION 'motivo es obligatorio (min 3 chars)';
  END IF;

  SELECT * INTO v_item FROM public.table_order_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item no encontrado'; END IF;

  SELECT * INTO v_order FROM public.table_orders WHERE id = v_item.table_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden no encontrada'; END IF;
  v_org := v_order.organization_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = v_org AND m.user_id = v_user
      AND m.role IN ('owner','admin','manager','cashier','waiter')
  ) AND NOT public.has_role(v_user, 'superadmin')
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_item.status = 'cancelled' THEN
    RAISE EXCEPTION 'item ya estaba anulado';
  END IF;

  -- Lock fiscal chain por org
  PERFORM pg_advisory_xact_lock(hashtextextended('fiscal_adj_log_' || v_org::text, 0));

  -- Siguiente void ticket
  SELECT COALESCE(MAX(void_ticket_number),0) + 1 INTO v_ticket
    FROM public.pos_void_log WHERE organization_id = v_org;

  INSERT INTO public.pos_void_log(
    organization_id, table_order_id, table_order_item_id, product_id,
    product_name, quantity, amount, reason_code, reason_text,
    void_ticket_number, voided_by
  ) VALUES (
    v_org, v_order.id, v_item.id, v_item.product_id,
    v_item.product_name, v_item.quantity, v_item.total, _reason_code, _reason_text,
    v_ticket, v_user
  ) RETURNING id INTO v_void_id;

  -- Cadena hash fiscal
  SELECT COALESCE(MAX(sequence),0) + 1,
         (SELECT current_hash FROM public.fiscal_adjustment_log
            WHERE organization_id = v_org ORDER BY sequence DESC LIMIT 1)
    INTO v_seq, v_prev_hash
    FROM public.fiscal_adjustment_log
   WHERE organization_id = v_org;

  v_payload := jsonb_build_object(
    'table_order_id', v_order.id,
    'item_id', v_item.id,
    'product_id', v_item.product_id,
    'product_name', v_item.product_name,
    'reason_code', _reason_code,
    'void_ticket_number', v_ticket,
    'was_sent_to_kitchen', v_item.status <> 'pending'
  );

  v_canon := COALESCE(v_prev_hash,'') || '|' || v_org::text || '|' || v_seq::text || '|'
          || 'pos_void_log' || '|' || v_void_id::text || '|' || 'pos_void' || '|'
          || COALESCE(v_user::text,'') || '|' || COALESCE(v_item.total::text,'') || '|'
          || COALESCE(v_item.quantity::text,'') || '|' || COALESCE(_reason_text,'') || '|'
          || v_payload::text;

  v_hash := encode(digest(v_canon, 'sha256'), 'hex');

  INSERT INTO public.fiscal_adjustment_log(
    organization_id, sequence, source_table, source_id, action,
    actor_id, amount, quantity, reason, payload, prev_hash, current_hash
  ) VALUES (
    v_org, v_seq, 'pos_void_log', v_void_id, 'pos_void',
    v_user, v_item.total, v_item.quantity, _reason_text, v_payload, v_prev_hash, v_hash
  );

  -- Marca el item como cancelado (queda visible en la comanda con vale)
  UPDATE public.table_order_items
     SET status = 'cancelled',
         notes  = COALESCE(notes,'') || ' [ANULADO #' || v_ticket || ' — ' || _reason_code || ']'
   WHERE id = v_item.id;

  -- Recalcular totales de la orden (excluyendo cancelled)
  UPDATE public.table_orders o
     SET subtotal = sub.t, total = sub.t
    FROM (
      SELECT COALESCE(SUM(total),0) AS t
        FROM public.table_order_items
       WHERE table_order_id = v_order.id AND status <> 'cancelled'
    ) sub
   WHERE o.id = v_order.id;

  -- Encolar impresión del vale (best-effort)
  BEGIN
    INSERT INTO public.print_jobs(
      organization_id, job_type, status, payload, created_by
    ) VALUES (
      v_org, 'void_voucher', 'queued',
      jsonb_build_object(
        'void_id', v_void_id,
        'ticket', v_ticket,
        'table_order_id', v_order.id,
        'product_name', v_item.product_name,
        'quantity', v_item.quantity,
        'amount', v_item.total,
        'reason_code', _reason_code,
        'reason_text', _reason_text,
        'fiscal_hash', v_hash
      ),
      v_user
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si la tabla/columna difiere, no abortamos el void.
    NULL;
  END;

  RETURN jsonb_build_object(
    'void_id', v_void_id,
    'ticket', v_ticket,
    'fiscal_sequence', v_seq,
    'fiscal_hash', v_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_void_table_item(UUID, TEXT, TEXT) TO authenticated;
