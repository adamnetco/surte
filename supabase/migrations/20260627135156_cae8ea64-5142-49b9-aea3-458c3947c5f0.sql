ALTER TABLE public.stock_transfers
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_stock_transfers_org_status
  ON public.stock_transfers(organization_id, status);