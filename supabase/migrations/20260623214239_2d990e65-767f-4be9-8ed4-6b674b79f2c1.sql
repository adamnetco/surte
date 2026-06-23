-- Slice 4 Innapsis: estados de retry/dead-letter en facturas electrónicas
ALTER TABLE public.electronic_invoices DROP CONSTRAINT IF EXISTS electronic_invoices_status_check;
ALTER TABLE public.electronic_invoices ADD CONSTRAINT electronic_invoices_status_check
  CHECK (status IN ('pending','sending','retrying','sent','accepted','rejected','void','error','dead_letter'));

ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS outbox_id uuid;

CREATE INDEX IF NOT EXISTS idx_einvoice_retry ON public.electronic_invoices(status, next_retry_at)
  WHERE status IN ('retrying','dead_letter');