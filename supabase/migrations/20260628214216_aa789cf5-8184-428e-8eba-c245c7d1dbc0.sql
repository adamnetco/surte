CREATE OR REPLACE FUNCTION public.register_referral_conversion(
  p_code text,
  p_referee_org_id uuid,
  p_referee_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row public.referral_codes%ROWTYPE;
  v_cfg public.referral_rewards_config%ROWTYPE;
  v_conv_id uuid;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 OR p_referee_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_code_row
  FROM public.referral_codes
  WHERE upper(code) = upper(trim(p_code))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_code_row.expires_at IS NOT NULL AND v_code_row.expires_at < now() THEN RETURN NULL; END IF;
  IF v_code_row.max_uses IS NOT NULL AND v_code_row.uses_count >= v_code_row.max_uses THEN RETURN NULL; END IF;
  IF v_code_row.organization_id = p_referee_org_id THEN RETURN NULL; END IF;

  -- Evitar duplicado por organización referida
  SELECT id INTO v_conv_id
  FROM public.referral_conversions
  WHERE referee_org_id = p_referee_org_id
  LIMIT 1;
  IF FOUND THEN RETURN v_conv_id; END IF;

  SELECT * INTO v_cfg
  FROM public.referral_rewards_config
  WHERE is_active = true AND plan_code IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.referral_conversions (
    referral_code_id, referrer_org_id, referee_org_id, referee_email,
    status, reward_amount, reward_currency
  ) VALUES (
    v_code_row.id, v_code_row.organization_id, p_referee_org_id, NULLIF(trim(p_referee_email), ''),
    'pending',
    COALESCE(v_cfg.referrer_reward_amount, 50000),
    COALESCE(v_cfg.referrer_reward_currency, 'COP')
  )
  RETURNING id INTO v_conv_id;

  UPDATE public.referral_codes
  SET uses_count = uses_count + 1, updated_at = now()
  WHERE id = v_code_row.id;

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_referral_conversion(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_referral_conversion(text, uuid, text) TO authenticated, service_role;