ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS reference_invoice_id uuid REFERENCES public.electronic_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_cufe text,
  ADD COLUMN IF NOT EXISTS reference_full_number text,
  ADD COLUMN IF NOT EXISTS reference_issue_date timestamptz,
  ADD COLUMN IF NOT EXISTS note_concept_code text,
  ADD COLUMN IF NOT EXISTS note_concept_text text;

CREATE INDEX IF NOT EXISTS idx_einvoice_reference
  ON public.electronic_invoices(reference_invoice_id)
  WHERE reference_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.electronic_invoices.note_concept_code IS
  'NC (credit_note): 1=Devolucion, 2=Anulacion, 3=Rebaja, 4=Descuento, 5=Rescision, 6=Otros. ND (debit_note): 1=Intereses, 2=Gastos, 3=Cambio valor, 4=Otros.';