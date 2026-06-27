
-- Ola 15 Slice 1: Wompi billing columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_source_id text,
  ADD COLUMN IF NOT EXISTS payment_method_brand text,
  ADD COLUMN IF NOT EXISTS payment_method_last4 text,
  ADD COLUMN IF NOT EXISTS last_payment_error text,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_retry
  ON public.subscriptions(next_retry_at)
  WHERE status IN ('past_due','active') AND next_retry_at IS NOT NULL;

ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS wompi_transaction_id text,
  ADD COLUMN IF NOT EXISTS wompi_reference text,
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS payment_method jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subinv_wompi_ref
  ON public.subscription_invoices(wompi_reference)
  WHERE wompi_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subinv_status_due
  ON public.subscription_invoices(status, due_date);
