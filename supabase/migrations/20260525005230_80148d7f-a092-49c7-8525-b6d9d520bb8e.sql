-- Sobrecarga "simple" del logger para usos rápidos desde edge functions.
-- Mantiene la firma avanzada existente; PostgreSQL las resuelve por aridad/tipos.
CREATE OR REPLACE FUNCTION public.log_sync_event(
  p_org_id   uuid,
  p_service  text,
  p_status   text,
  p_error    text   DEFAULT NULL,
  p_payload  jsonb  DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_status NOT IN ('pending','success','error','partial') THEN
    RAISE EXCEPTION 'invalid_status: %', p_status;
  END IF;

  INSERT INTO public.sync_logs (organization_id, service_name, status, error_message, payload, last_run_at)
  VALUES (p_org_id, p_service, p_status, p_error, COALESCE(p_payload, '{}'::jsonb), now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_sync_event(uuid, text, text, text, jsonb) TO authenticated, service_role;