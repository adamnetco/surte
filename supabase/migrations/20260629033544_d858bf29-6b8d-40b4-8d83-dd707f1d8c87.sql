-- ============================================================
-- Ola 25 · Slice 2 — Sello fiscal por turno + cadena hash inmutable
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cash_session_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  prev_hash TEXT,
  current_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cash_session_id),
  UNIQUE (cash_register_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_css_org ON public.cash_session_seals(organization_id);
CREATE INDEX IF NOT EXISTS idx_css_register_seq ON public.cash_session_seals(cash_register_id, sequence DESC);

GRANT SELECT ON public.cash_session_seals TO authenticated;
GRANT ALL ON public.cash_session_seals TO service_role;

ALTER TABLE public.cash_session_seals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_seals"
ON public.cash_session_seals FOR SELECT
TO authenticated
USING (public.is_member_of(organization_id));

-- columna en cash_sessions
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS fiscal_seal_id UUID REFERENCES public.cash_session_seals(id);

-- =================== RPC: emit seal ===================
CREATE OR REPLACE FUNCTION public.cash_session_emit_seal(_session_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.cash_sessions%ROWTYPE;
  v_prev    public.cash_session_seals%ROWTYPE;
  v_existing UUID;
  v_seq     BIGINT;
  v_prev_hash TEXT;
  v_payload JSONB;
  v_hash    TEXT;
  v_seal_id UUID;
BEGIN
  SELECT * INTO v_session FROM public.cash_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cash_session_not_found';
  END IF;

  -- idempotente
  SELECT id INTO v_existing FROM public.cash_session_seals WHERE cash_session_id = _session_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_prev
  FROM public.cash_session_seals
  WHERE cash_register_id = v_session.cash_register_id
  ORDER BY sequence DESC
  LIMIT 1;

  v_seq := COALESCE(v_prev.sequence, 0) + 1;
  v_prev_hash := v_prev.current_hash;

  v_payload := jsonb_build_object(
    'session_id', v_session.id,
    'organization_id', v_session.organization_id,
    'cash_register_id', v_session.cash_register_id,
    'opened_at', v_session.opened_at,
    'closed_at', v_session.closed_at,
    'opening_amount', v_session.opening_amount,
    'expected_cash', v_session.expected_cash,
    'counted_cash', v_session.counted_cash,
    'difference', COALESCE(v_session.counted_cash,0) - COALESCE(v_session.expected_cash,0),
    'denominations_hash', v_session.denominations_hash,
    'sequence', v_seq,
    'prev_hash', v_prev_hash
  );

  v_hash := encode(digest(coalesce(v_prev_hash,'') || '|' || v_payload::text, 'sha256'), 'hex');

  INSERT INTO public.cash_session_seals (
    organization_id, cash_register_id, cash_session_id, sequence, prev_hash, current_hash, payload
  ) VALUES (
    v_session.organization_id, v_session.cash_register_id, v_session.id, v_seq, v_prev_hash, v_hash, v_payload
  ) RETURNING id INTO v_seal_id;

  UPDATE public.cash_sessions SET fiscal_seal_id = v_seal_id WHERE id = v_session.id;

  RETURN v_seal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cash_session_emit_seal(UUID) TO authenticated, service_role;

-- =================== Trigger: auto-emit on close ===================
CREATE OR REPLACE FUNCTION public.trg_cash_session_emit_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    PERFORM public.cash_session_emit_seal(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_session_emit_seal ON public.cash_sessions;
CREATE TRIGGER trg_cash_session_emit_seal
AFTER UPDATE ON public.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trg_cash_session_emit_seal();

-- =================== RPC: verify chain ===================
CREATE OR REPLACE FUNCTION public.cash_session_verify_chain(_register_id UUID, _limit INT DEFAULT 500)
RETURNS TABLE (
  sequence BIGINT,
  seal_id UUID,
  cash_session_id UUID,
  current_hash TEXT,
  expected_prev_hash TEXT,
  stored_prev_hash TEXT,
  ok BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.cash_registers WHERE id = _register_id;
  IF NOT public.is_member_of(v_org) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH seals AS (
    SELECT s.*, LAG(s.current_hash) OVER (ORDER BY s.sequence) AS expected_prev
    FROM public.cash_session_seals s
    WHERE s.cash_register_id = _register_id
    ORDER BY s.sequence
    LIMIT _limit
  )
  SELECT s.sequence, s.id, s.cash_session_id, s.current_hash,
         s.expected_prev, s.prev_hash,
         (s.expected_prev IS NOT DISTINCT FROM s.prev_hash) AS ok
  FROM seals s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cash_session_verify_chain(UUID, INT) TO authenticated, service_role;