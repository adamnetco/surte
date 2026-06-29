
ALTER TABLE public.api_alerts ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.trg_notify_api_alert_critical()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity = 'critical' AND NEW.status = 'open' THEN
    PERFORM net.http_post(
      url := 'https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1/notify-api-alert',
      headers := jsonb_build_object('content-type','application/json'),
      body := jsonb_build_object('alert_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_alerts_notify_critical ON public.api_alerts;
CREATE TRIGGER api_alerts_notify_critical
AFTER INSERT ON public.api_alerts
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_api_alert_critical();
