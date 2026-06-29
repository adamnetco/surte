
-- =====================================================================
-- OLA 25 · SLICE 3 — Libro auxiliar de caja + export DIAN
-- =====================================================================

-- 1) FIX latent bug from Slice 2: column names
CREATE OR REPLACE FUNCTION public.cash_session_emit_seal(_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session   public.cash_sessions%ROWTYPE;
  v_prev_hash text;
  v_seq       int;
  v_payload   jsonb;
  v_hash      text;
  v_seal_id   uuid;
  v_denom_hash text;
BEGIN
  SELECT * INTO v_session FROM public.cash_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cash_session_not_found'; END IF;
  IF v_session.fiscal_seal_id IS NOT NULL THEN RETURN v_session.fiscal_seal_id; END IF;
  IF v_session.status <> 'closed' THEN RAISE EXCEPTION 'session_not_closed'; END IF;

  SELECT current_hash, sequence INTO v_prev_hash, v_seq
  FROM public.cash_session_seals
  WHERE cash_register_id = v_session.cash_register_id
  ORDER BY sequence DESC LIMIT 1;
  v_seq := COALESCE(v_seq, 0) + 1;

  BEGIN
    v_denom_hash := public.cash_session_compute_denom_hash(_session_id);
  EXCEPTION WHEN OTHERS THEN
    v_denom_hash := NULL;
  END;

  v_payload := jsonb_build_object(
    'session_id', v_session.id,
    'organization_id', v_session.organization_id,
    'cash_register_id', v_session.cash_register_id,
    'opened_at', v_session.opened_at,
    'closed_at', v_session.closed_at,
    'opening_amount', v_session.opening_amount,
    'expected_amount', v_session.expected_amount,
    'closing_amount', v_session.closing_amount,
    'difference', COALESCE(v_session.closing_amount,0) - COALESCE(v_session.expected_amount,0),
    'total_sales', v_session.total_sales,
    'ticket_count', v_session.ticket_count,
    'denominations_hash', v_denom_hash,
    'prev_hash', v_prev_hash,
    'sequence', v_seq
  );

  v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.cash_session_seals (
    organization_id, cash_register_id, cash_session_id, sequence, prev_hash, current_hash, payload
  ) VALUES (
    v_session.organization_id, v_session.cash_register_id, v_session.id, v_seq, v_prev_hash, v_hash, v_payload
  ) RETURNING id INTO v_seal_id;

  UPDATE public.cash_sessions SET fiscal_seal_id = v_seal_id WHERE id = _session_id;
  RETURN v_seal_id;
END $$;

GRANT EXECUTE ON FUNCTION public.cash_session_emit_seal(uuid) TO authenticated;

-- =====================================================================
-- 2) RPC: cash_book_auxiliary
-- Libro auxiliar de caja por rango de fechas y caja registradora.
-- Retorna una fila por sesión cerrada con apertura, ventas por método,
-- ingresos/egresos manuales, esperado, contado, diferencia y sello.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cash_book_auxiliary(
  _org_id uuid,
  _from   date,
  _to     date,
  _register_id uuid DEFAULT NULL
)
RETURNS TABLE (
  session_id       uuid,
  register_id      uuid,
  register_name    text,
  location_name    text,
  opened_at        timestamptz,
  closed_at        timestamptz,
  status           text,
  opening_amount   numeric,
  total_sales      numeric,
  total_cash       numeric,
  total_card       numeric,
  total_transfer   numeric,
  total_other      numeric,
  ticket_count     int,
  expected_amount  numeric,
  closing_amount   numeric,
  difference       numeric,
  fiscal_seal_seq  int,
  fiscal_seal_hash text,
  notes            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.cash_register_id,
    r.name,
    l.name,
    s.opened_at,
    s.closed_at,
    s.status,
    s.opening_amount,
    s.total_sales,
    s.total_cash,
    s.total_card,
    s.total_transfer,
    s.total_other,
    s.ticket_count,
    s.expected_amount,
    s.closing_amount,
    s.difference,
    seal.sequence,
    seal.current_hash,
    s.notes
  FROM public.cash_sessions s
  JOIN public.cash_registers r ON r.id = s.cash_register_id
  JOIN public.locations l      ON l.id = s.location_id
  LEFT JOIN public.cash_session_seals seal ON seal.id = s.fiscal_seal_id
  WHERE s.organization_id = _org_id
    AND (_register_id IS NULL OR s.cash_register_id = _register_id)
    AND s.opened_at >= _from::timestamptz
    AND s.opened_at < (_to + INTERVAL '1 day')
    AND (
      public.is_member_of(s.organization_id)
      OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role])
    )
  ORDER BY s.opened_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.cash_book_auxiliary(uuid, date, date, uuid) TO authenticated;
