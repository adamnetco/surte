CREATE OR REPLACE FUNCTION public.set_subscription_cancel_at_period_end(
  p_org_id uuid,
  p_cancel boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_sub record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role
  FROM organization_members
  WHERE organization_id = p_org_id AND user_id = v_user
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    IF NOT public.has_role(v_user, 'superadmin'::app_role) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE subscriptions
     SET cancel_at_period_end = p_cancel,
         canceled_at = CASE WHEN p_cancel THEN now() ELSE NULL END,
         updated_at = now()
   WHERE organization_id = p_org_id
     AND status IN ('active','trialing','past_due')
  RETURNING * INTO v_sub;

  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'no_active_subscription';
  END IF;

  RETURN jsonb_build_object(
    'subscription_id', v_sub.id,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'current_period_end', v_sub.current_period_end,
    'status', v_sub.status
  );
END $$;

REVOKE ALL ON FUNCTION public.set_subscription_cancel_at_period_end(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_subscription_cancel_at_period_end(uuid, boolean) TO authenticated;