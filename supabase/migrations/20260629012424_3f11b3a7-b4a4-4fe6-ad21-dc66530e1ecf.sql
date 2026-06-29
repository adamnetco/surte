CREATE OR REPLACE FUNCTION public.webhook_replay_delivery(p_delivery_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src record;
  v_new uuid;
BEGIN
  SELECT id, organization_id, endpoint_id, event_type, payload
    INTO v_src
  FROM public.webhook_deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery_not_found';
  END IF;

  IF NOT (
    public.org_role(v_src.organization_id) IN ('owner','admin')
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.webhook_deliveries(
    endpoint_id, organization_id, event_type, payload,
    status, attempt_count, next_attempt_at
  )
  VALUES (
    v_src.endpoint_id, v_src.organization_id, v_src.event_type, v_src.payload,
    'pending', 0, now()
  )
  RETURNING id INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_replay_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_replay_delivery(uuid) TO authenticated;