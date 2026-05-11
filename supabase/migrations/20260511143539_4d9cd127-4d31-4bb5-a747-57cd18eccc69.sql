REVOKE SELECT (customer_email, customer_phone) ON public.customer_reviews FROM anon, authenticated;

DROP POLICY IF EXISTS "Coupons readable by everyone" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated can view active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _order_total numeric)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  discount_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  disc numeric;
BEGIN
  SELECT * INTO c FROM public.coupons
  WHERE code = upper(trim(_code)) AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_coupon';
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RAISE EXCEPTION 'expired_coupon';
  END IF;
  IF c.max_uses IS NOT NULL AND c.current_uses >= c.max_uses THEN
    RAISE EXCEPTION 'exhausted_coupon';
  END IF;
  IF c.min_order_amount IS NOT NULL AND _order_total < c.min_order_amount THEN
    RAISE EXCEPTION 'min_order_not_met';
  END IF;

  IF c.discount_type = 'percentage' THEN
    disc := round(_order_total * c.discount_value / 100);
  ELSE
    disc := c.discount_value;
  END IF;

  RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount, disc;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated int;
BEGIN
  UPDATE public.coupons
     SET current_uses = current_uses + 1,
         updated_at = now()
   WHERE id = _coupon_id
     AND is_active = true
     AND (max_uses IS NULL OR current_uses < max_uses)
     AND (expires_at IS NULL OR expires_at > now());
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_coupon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(uuid) TO anon, authenticated;