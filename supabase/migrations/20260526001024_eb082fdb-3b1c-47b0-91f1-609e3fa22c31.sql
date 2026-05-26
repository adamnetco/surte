CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_next_attempt
  ON public.sync_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'dead');