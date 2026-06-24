-- Columnas para soportar el flujo de contingencia DIAN (AC11-AC12 POS-innapsis-emision-pos)
ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS is_contingency BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contingency_emitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transmitted_at TIMESTAMPTZ;

-- Permitir el nuevo estado lógico 'contingency' (no toca CHECK porque la columna status es TEXT libre hoy).
COMMENT ON COLUMN public.electronic_invoices.is_contingency IS
  'TRUE si el documento se emitió usando rango de contingencia (DIAN offline). Una vez transmitido a DIAN, transmitted_at se llena pero is_contingency permanece para auditoría.';

-- Índice para el worker einvoice-contingency-flush
CREATE INDEX IF NOT EXISTS idx_einvoices_contingency_pending
  ON public.electronic_invoices (organization_id, transmitted_at, contingency_emitted_at)
  WHERE is_contingency = true AND transmitted_at IS NULL;