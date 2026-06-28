CREATE OR REPLACE FUNCTION public.expire_referral_credits()
RETURNS TABLE(expired_count integer, expired_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_amount numeric := 0;
BEGIN
  WITH expired AS (
    UPDATE public.referral_credits SET status='expired', updated_at=now()
    WHERE status='available' AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING amount
  )
  SELECT COUNT(*), COALESCE(SUM(amount),0) INTO v_count, v_amount FROM expired;
  RETURN QUERY SELECT v_count, v_amount;
END; $$;
REVOKE ALL ON FUNCTION public.expire_referral_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_referral_credits() TO service_role;

CREATE OR REPLACE VIEW public.v_referral_program_kpis WITH (security_invoker = on) AS
SELECT
  (SELECT COUNT(*) FROM public.referral_codes WHERE is_active) AS active_codes,
  (SELECT COUNT(*) FROM public.referral_conversions) AS total_conversions,
  (SELECT COUNT(*) FROM public.referral_conversions WHERE status='qualified') AS qualified_conversions,
  (SELECT COALESCE(SUM(amount),0) FROM public.referral_credits) AS total_credits_issued,
  (SELECT COALESCE(SUM(amount),0) FROM public.referral_credits WHERE status='available') AS total_credits_available,
  (SELECT COALESCE(SUM(amount),0) FROM public.referral_credits WHERE status='consumed') AS total_credits_redeemed,
  (SELECT COALESCE(SUM(amount),0) FROM public.referral_credits WHERE status='expired') AS total_credits_expired,
  (SELECT COALESCE(SUM(credit_applied_amount),0) FROM public.subscription_invoices WHERE credit_applied_amount>0) AS total_applied_to_invoices;
GRANT SELECT ON public.v_referral_program_kpis TO authenticated;

CREATE OR REPLACE VIEW public.v_referral_top_referrers WITH (security_invoker = on) AS
SELECT rc.code, rc.organization_id, o.name AS organization_name,
  COUNT(rcv.id) FILTER (WHERE rcv.status='qualified') AS qualified_count,
  COUNT(rcv.id) AS total_conversions,
  COALESCE(SUM(rcr.amount) FILTER (WHERE rcr.status IN ('available','consumed')),0) AS total_credits_earned,
  COALESCE(SUM(rcr.amount) FILTER (WHERE rcr.status='available'),0) AS credits_available
FROM public.referral_codes rc
LEFT JOIN public.organizations o ON o.id=rc.organization_id
LEFT JOIN public.referral_conversions rcv ON rcv.referrer_org_id=rc.organization_id
LEFT JOIN public.referral_credits rcr ON rcr.organization_id=rc.organization_id
GROUP BY rc.code, rc.organization_id, o.name
ORDER BY qualified_count DESC NULLS LAST, total_credits_earned DESC
LIMIT 50;
GRANT SELECT ON public.v_referral_top_referrers TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='referral-credits-expire-daily') THEN
    PERFORM cron.unschedule('referral-credits-expire-daily');
  END IF;
END $$;
SELECT cron.schedule('referral-credits-expire-daily','0 3 * * *',$$SELECT public.expire_referral_credits();$$);
