
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-sso-tokens-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-sso-tokens-5min',
  '*/5 * * * *',
  $$SELECT public.cleanup_sso_tokens();$$
);
