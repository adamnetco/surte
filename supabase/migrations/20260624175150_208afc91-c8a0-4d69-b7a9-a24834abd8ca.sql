ALTER TABLE public.fx_transactions
  ADD COLUMN IF NOT EXISTS mid_rate numeric,
  ADD COLUMN IF NOT EXISTS commission_amount numeric,
  ADD COLUMN IF NOT EXISTS commission_currency_id uuid REFERENCES public.fx_currencies(id),
  ADD COLUMN IF NOT EXISTS commission_invoice_status text NOT NULL DEFAULT 'pending'
    CHECK (commission_invoice_status IN ('pending','queued','emitted','failed','skipped'));

CREATE INDEX IF NOT EXISTS idx_fx_tx_commission_status
  ON public.fx_transactions(organization_id, commission_invoice_status)
  WHERE commission_invoice_status IN ('pending','failed');