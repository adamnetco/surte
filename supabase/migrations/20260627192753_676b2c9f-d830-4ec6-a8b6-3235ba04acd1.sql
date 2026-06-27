-- Ola 15 Slice 5: Retry tracking for failed Wompi invoices
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_url text;

CREATE INDEX IF NOT EXISTS idx_sub_invoices_retry
  ON public.subscription_invoices (status, next_retry_at)
  WHERE status = 'failed';
