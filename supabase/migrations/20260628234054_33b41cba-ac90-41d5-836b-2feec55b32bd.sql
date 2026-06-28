
SELECT cron.schedule(
  'webhooks-dispatch-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1/webhooks-dispatch-worker',
    headers := jsonb_build_object('content-type','application/json'),
    body := '{}'::jsonb
  );
  $$
);
