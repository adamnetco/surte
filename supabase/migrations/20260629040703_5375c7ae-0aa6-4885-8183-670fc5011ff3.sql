-- Ola 25 · Slice 4: Audit trail reforzado — logs inmutables de ajustes

CREATE TABLE IF NOT EXISTS public.fiscal_adjustment_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence        BIGINT NOT NULL,
  source_table    TEXT NOT NULL CHECK (source_table IN ('stock_movements','cash_movements')),
  source_id       UUID NOT NULL,
  action          TEXT NOT NULL,            -- e.g. 'stock_adjustment', 'cash_adjustment_in', 'cash_adjustment_out'
  actor_id        UUID,
  amount          NUMERIC(18,4),
  quantity        NUMERIC(18,4),
  reason          TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       TEXT,
  current_hash    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sequence),
  UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_adj_log_org_created
  ON public.fiscal_adjustment_log (organization_id, created_at DESC);

GRANT SELECT ON public.fiscal_adjustment_log TO authenticated;
GRANT ALL    ON public.fiscal_adjustment_log TO service_role;

ALTER TABLE public.fiscal_adjustment_log ENABLE ROW LEVEL SECURITY;

-- Solo superadmin + admin pueden ver el log; nadie inserta/edita/elimina vía API.
CREATE POLICY "fiscal_adj_log_read_admin_or_superadmin"
  ON public.fiscal_adjustment_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = fiscal_adjustment_log.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

-- Trigger function — append-only con hash encadenado
CREATE OR REPLACE FUNCTION public.fiscal_adj_log_append()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq       BIGINT;
  v_prev_hash TEXT;
  v_action    TEXT;
  v_actor     UUID;
  v_amount    NUMERIC;
  v_qty       NUMERIC;
  v_reason    TEXT;
  v_payload   JSONB;
  v_canon     TEXT;
  v_hash      TEXT;
  v_src_id    UUID;
  v_org       UUID;
BEGIN
  IF TG_TABLE_NAME = 'stock_movements' THEN
    IF NEW.movement_type IS DISTINCT FROM 'adjustment' THEN
      RETURN NEW;
    END IF;
    v_action  := 'stock_adjustment';
    v_actor   := NEW.created_by;
    v_qty     := NEW.quantity;
    v_amount  := NEW.unit_cost;
    v_reason  := NEW.notes;
    v_src_id  := NEW.id;
    v_org     := NEW.organization_id;
    v_payload := jsonb_build_object(
      'warehouse_id', NEW.warehouse_id,
      'product_id', NEW.product_id,
      'presentation_id', NEW.presentation_id,
      'balance_after', NEW.balance_after,
      'reference_type', NEW.reference_type,
      'reference_id', NEW.reference_id
    );
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    IF NEW.movement_type NOT IN ('ajuste_entrada','ajuste_salida','adjustment_in','adjustment_out') THEN
      RETURN NEW;
    END IF;
    v_action  := 'cash_' || NEW.movement_type;
    v_actor   := NEW.created_by;
    v_amount  := NEW.amount;
    v_qty     := NULL;
    v_reason  := NEW.concept;
    v_src_id  := NEW.id;
    v_org     := NEW.organization_id;
    v_payload := jsonb_build_object(
      'cash_session_id', NEW.cash_session_id,
      'reference', NEW.reference
    );
  ELSE
    RETURN NEW;
  END IF;

  -- siguiente sequence y prev_hash, bloqueando inserts concurrentes en la org
  PERFORM pg_advisory_xact_lock(hashtextextended('fiscal_adj_log_' || v_org::text, 0));

  SELECT COALESCE(MAX(sequence), 0) + 1,
         (SELECT current_hash FROM public.fiscal_adjustment_log
            WHERE organization_id = v_org ORDER BY sequence DESC LIMIT 1)
    INTO v_seq, v_prev_hash
    FROM public.fiscal_adjustment_log
   WHERE organization_id = v_org;

  v_canon := COALESCE(v_prev_hash,'') || '|' || v_org::text || '|' || v_seq::text || '|'
          || TG_TABLE_NAME || '|' || v_src_id::text || '|' || v_action || '|'
          || COALESCE(v_actor::text,'') || '|' || COALESCE(v_amount::text,'') || '|'
          || COALESCE(v_qty::text,'') || '|' || COALESCE(v_reason,'') || '|'
          || v_payload::text;

  v_hash := encode(digest(v_canon, 'sha256'), 'hex');

  INSERT INTO public.fiscal_adjustment_log(
    organization_id, sequence, source_table, source_id, action,
    actor_id, amount, quantity, reason, payload, prev_hash, current_hash
  ) VALUES (
    v_org, v_seq, TG_TABLE_NAME, v_src_id, v_action,
    v_actor, v_amount, v_qty, v_reason, v_payload, v_prev_hash, v_hash
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_adj_log_stock ON public.stock_movements;
CREATE TRIGGER trg_fiscal_adj_log_stock
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.fiscal_adj_log_append();

DROP TRIGGER IF EXISTS trg_fiscal_adj_log_cash ON public.cash_movements;
CREATE TRIGGER trg_fiscal_adj_log_cash
  AFTER INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.fiscal_adj_log_append();

-- Bloquea UPDATE/DELETE para reforzar inmutabilidad (defense-in-depth, además de RLS)
CREATE OR REPLACE FUNCTION public.fiscal_adj_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'fiscal_adjustment_log es inmutable (append-only)';
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_adj_log_no_update ON public.fiscal_adjustment_log;
CREATE TRIGGER trg_fiscal_adj_log_no_update
  BEFORE UPDATE OR DELETE ON public.fiscal_adjustment_log
  FOR EACH ROW EXECUTE FUNCTION public.fiscal_adj_log_immutable();

-- RPC para verificar integridad de la cadena
CREATE OR REPLACE FUNCTION public.fiscal_adj_log_verify(_org UUID)
RETURNS TABLE(total BIGINT, ok BIGINT, first_break BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_prev TEXT := NULL;
  v_canon TEXT;
  v_hash TEXT;
  v_total BIGINT := 0;
  v_ok BIGINT := 0;
  v_break BIGINT := NULL;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'superadmin')
       OR EXISTS (SELECT 1 FROM public.organization_members m
                   WHERE m.organization_id = _org AND m.user_id = auth.uid()
                     AND m.role IN ('owner','admin')))
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT * FROM public.fiscal_adjustment_log
     WHERE organization_id = _org
     ORDER BY sequence ASC
  LOOP
    v_total := v_total + 1;
    v_canon := COALESCE(v_prev,'') || '|' || r.organization_id::text || '|' || r.sequence::text || '|'
            || r.source_table || '|' || r.source_id::text || '|' || r.action || '|'
            || COALESCE(r.actor_id::text,'') || '|' || COALESCE(r.amount::text,'') || '|'
            || COALESCE(r.quantity::text,'') || '|' || COALESCE(r.reason,'') || '|'
            || r.payload::text;
    v_hash := encode(digest(v_canon, 'sha256'), 'hex');
    IF v_hash = r.current_hash AND COALESCE(r.prev_hash,'') = COALESCE(v_prev,'') THEN
      v_ok := v_ok + 1;
    ELSIF v_break IS NULL THEN
      v_break := r.sequence;
    END IF;
    v_prev := r.current_hash;
  END LOOP;

  RETURN QUERY SELECT v_total, v_ok, v_break;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fiscal_adj_log_verify(UUID) TO authenticated;