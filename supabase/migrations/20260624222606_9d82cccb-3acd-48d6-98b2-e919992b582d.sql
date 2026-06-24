
ALTER TABLE public.fx_transactions
  ADD COLUMN IF NOT EXISTS commission_invoice_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_invoice_next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_invoice_last_error text;

CREATE INDEX IF NOT EXISTS idx_fx_tx_commission_retry
  ON public.fx_transactions (commission_invoice_next_retry_at)
  WHERE commission_invoice_status = 'failed';
